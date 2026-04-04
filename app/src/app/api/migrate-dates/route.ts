import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST() {
  try {
    // Undo previous migration: shift all dates FORWARD by 1 day
    // Restores dates to their original UTC midnight values
    const results = await Promise.all([
      prisma.$executeRawUnsafe(`UPDATE "TimeEntry" SET date = date + INTERVAL '1 day'`),
      prisma.$executeRawUnsafe(`UPDATE "Expense" SET date = date + INTERVAL '1 day'`),
      prisma.$executeRawUnsafe(`UPDATE "DailyNote" SET date = date + INTERVAL '1 day'`),
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
