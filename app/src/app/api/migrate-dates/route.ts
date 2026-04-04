import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST() {
  try {
    // Shift all dates back by 1 day using raw SQL
    // This fixes the UTC→JST migration: old records were stored as UTC midnight,
    // but now the app interprets dates as JST, causing a 1-day forward shift.
    const results = await Promise.all([
      prisma.$executeRawUnsafe(`UPDATE "TimeEntry" SET date = date - INTERVAL '1 day'`),
      prisma.$executeRawUnsafe(`UPDATE "Expense" SET date = date - INTERVAL '1 day'`),
      prisma.$executeRawUnsafe(`UPDATE "DailyNote" SET date = date - INTERVAL '1 day'`),
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
