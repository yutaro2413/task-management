import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const [timeEntries, expenses, dailyNotes] = await Promise.all([
    prisma.timeEntry.findMany({ orderBy: { date: "asc" }, take: 5, select: { id: true, date: true, title: true } }),
    prisma.expense.findMany({ orderBy: { date: "asc" }, take: 5, select: { id: true, date: true, memo: true } }),
    prisma.dailyNote.findMany({ orderBy: { date: "asc" }, take: 5, select: { id: true, date: true } }),
  ]);
  return NextResponse.json({ timeEntries, expenses, dailyNotes });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const action = body.action ?? "shift";
    const days = body.days ?? 2;
    const tables: string[] = body.tables ?? ["TimeEntry", "Expense", "DailyNote"];

    if (action === "drop-constraint") {
      // Step 1: just drop the constraint
      await prisma.$executeRawUnsafe(
        `ALTER TABLE "DailyNote" DROP CONSTRAINT IF EXISTS "DailyNote_date_key"`
      );
      // Also try dropping any auto-generated unique index
      await prisma.$executeRawUnsafe(
        `DROP INDEX IF EXISTS "DailyNote_date_key"`
      );
      return NextResponse.json({ success: true, action: "drop-constraint" });
    }

    if (action === "add-constraint") {
      await prisma.$executeRawUnsafe(
        `ALTER TABLE "DailyNote" ADD CONSTRAINT "DailyNote_date_key" UNIQUE (date)`
      );
      return NextResponse.json({ success: true, action: "add-constraint" });
    }

    if (action === "shift-daily-notes") {
      // Shift daily notes by replacing: delete all, then re-insert with new dates
      const notes = await prisma.dailyNote.findMany({ orderBy: { date: "asc" } });
      const shiftMs = days * 24 * 60 * 60 * 1000;

      // Delete all
      await prisma.dailyNote.deleteMany();

      // Re-create with shifted dates
      let count = 0;
      for (const note of notes) {
        const newDate = new Date(note.date.getTime() + shiftMs);
        await prisma.dailyNote.create({
          data: {
            date: newDate,
            content: note.content,
          },
        });
        count++;
      }

      return NextResponse.json({ success: true, action: "shift-daily-notes", days, count });
    }

    // Default: shift TimeEntry/Expense
    const interval = days > 0
      ? `+ INTERVAL '${days} days'`
      : `- INTERVAL '${Math.abs(days)} days'`;

    const results: string[] = [];
    for (const table of tables) {
      if (table === "DailyNote") continue; // Skip, use shift-daily-notes action
      const count = await prisma.$executeRawUnsafe(
        `UPDATE "${table}" SET date = date ${interval}`
      );
      results.push(`updated ${table}: ${count} rows`);
    }

    return NextResponse.json({ success: true, days, tables, results });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
