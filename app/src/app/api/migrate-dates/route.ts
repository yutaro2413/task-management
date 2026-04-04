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

    // Build a single raw SQL transaction string
    const sqlParts: string[] = ["BEGIN;"];

    if (tables.includes("DailyNote")) {
      sqlParts.push(`ALTER TABLE "DailyNote" DROP CONSTRAINT IF EXISTS "DailyNote_date_key";`);
    }

    for (const table of tables) {
      sqlParts.push(`UPDATE "${table}" SET date = date ${interval};`);
    }

    if (tables.includes("DailyNote")) {
      sqlParts.push(`ALTER TABLE "DailyNote" ADD CONSTRAINT "DailyNote_date_key" UNIQUE (date);`);
    }

    sqlParts.push("COMMIT;");

    // Execute as a single raw SQL block
    const sql = sqlParts.join("\n");
    await prisma.$executeRawUnsafe(sql);

    return NextResponse.json({
      success: true,
      days,
      tables,
      sql,
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
