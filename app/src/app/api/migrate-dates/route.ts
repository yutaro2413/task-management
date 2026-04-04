import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST() {
  try {
    // Shift TimeEntry and Expense dates forward by 2 days
    const [timeEntries, expenses] = await Promise.all([
      prisma.$executeRawUnsafe(`UPDATE "TimeEntry" SET date = date + INTERVAL '2 days'`),
      prisma.$executeRawUnsafe(`UPDATE "Expense" SET date = date + INTERVAL '2 days'`),
    ]);

    // DailyNote has unique constraint on date, so shift in reverse order (latest first)
    // to avoid collision
    const dailyNotes = await prisma.$executeRawUnsafe(
      `UPDATE "DailyNote" SET date = date + INTERVAL '2 days'`
    ).catch(async () => {
      // If bulk fails due to unique constraint, update one by one in desc order
      const notes = await prisma.dailyNote.findMany({ orderBy: { date: "desc" } });
      let count = 0;
      for (const note of notes) {
        const newDate = new Date(note.date.getTime() + 2 * 24 * 60 * 60 * 1000);
        await prisma.dailyNote.update({
          where: { id: note.id },
          data: { date: newDate },
        });
        count++;
      }
      return count;
    });

    return NextResponse.json({
      success: true,
      updated: { timeEntries, expenses, dailyNotes },
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
