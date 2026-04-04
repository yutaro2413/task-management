import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  // Diagnostic: show current state of dates in each table
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
    // days: how many days to shift. Can be negative.
    // tables: which tables to shift (default all)
    const days = body.days ?? 2;
    const tables: string[] = body.tables ?? ["TimeEntry", "Expense", "DailyNote"];

    // Use a raw transaction to:
    // 1. Drop DailyNote unique constraint if DailyNote is included
    // 2. Update all requested tables
    // 3. Re-add unique constraint
    const statements: string[] = [];

    if (tables.includes("DailyNote")) {
      statements.push(`ALTER TABLE "DailyNote" DROP CONSTRAINT IF EXISTS "DailyNote_date_key"`);
    }

    for (const table of tables) {
      if (days > 0) {
        statements.push(`UPDATE "${table}" SET date = date + INTERVAL '${days} days'`);
      } else {
        statements.push(`UPDATE "${table}" SET date = date - INTERVAL '${Math.abs(days)} days'`);
      }
    }

    if (tables.includes("DailyNote")) {
      statements.push(`ALTER TABLE "DailyNote" ADD CONSTRAINT "DailyNote_date_key" UNIQUE (date)`);
    }

    // Execute all in a single transaction
    const results: number[] = [];
    await prisma.$transaction(async (tx) => {
      for (const sql of statements) {
        const r = await tx.$executeRawUnsafe(sql);
        results.push(r);
      }
    });

    return NextResponse.json({
      success: true,
      days,
      tables,
      statements: statements.length,
      results,
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
