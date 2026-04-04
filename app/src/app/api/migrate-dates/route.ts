import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST() {
  try {
    // Shift all dates forward by 2 days
    const results = await Promise.all([
      prisma.$executeRawUnsafe(`UPDATE "TimeEntry" SET date = date + INTERVAL '2 days'`),
      prisma.$executeRawUnsafe(`UPDATE "Expense" SET date = date + INTERVAL '2 days'`),
      prisma.$executeRawUnsafe(`UPDATE "DailyNote" SET date = date + INTERVAL '2 days'`),
    ]);

    return NextResponse.json({
      success: true,
      updated: {
        timeEntries: results[0],
        expenses: results[1],
        dailyNotes: results[2],
      },
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
