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
    const days = body.days ?? 2;
    const tables: string[] = body.tables ?? ["TimeEntry", "Expense", "DailyNote"];

    const interval = days > 0
      ? `+ INTERVAL '${days} days'`
      : `- INTERVAL '${Math.abs(days)} days'`;

    const results: string[] = [];

    // Step 1: Drop DailyNote unique constraint if needed
    if (tables.includes("DailyNote")) {
      await prisma.$executeRawUnsafe(
        `ALTER TABLE "DailyNote" DROP CONSTRAINT IF EXISTS "DailyNote_date_key"`
      );
      results.push("dropped DailyNote_date_key constraint");
    }

    // Step 2: Update each table
    for (const table of tables) {
      const count = await prisma.$executeRawUnsafe(
        `UPDATE "${table}" SET date = date ${interval}`
      );
      results.push(`updated ${table}: ${count} rows`);
    }

    // Step 3: Re-add DailyNote unique constraint
    if (tables.includes("DailyNote")) {
      await prisma.$executeRawUnsafe(
        `ALTER TABLE "DailyNote" ADD CONSTRAINT "DailyNote_date_key" UNIQUE (date)`
      );
      results.push("re-added DailyNote_date_key constraint");
    }

    return NextResponse.json({ success: true, days, tables, results });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
