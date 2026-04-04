import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function parseJSTDate(dateStr: string): Date {
  return new Date(dateStr + "T00:00:00+09:00");
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  const where: Record<string, unknown> = {};
  if (date) {
    where.date = parseJSTDate(date);
  } else if (startDate && endDate) {
    where.date = { gte: parseJSTDate(startDate), lte: parseJSTDate(endDate) };
  }

  const expenses = await prisma.expense.findMany({
    where,
    include: { category: true },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });
  return NextResponse.json(expenses);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const expense = await prisma.expense.create({
    data: {
      date: parseJSTDate(body.date),
      amount: body.amount,
      type: body.type || "expense",
      categoryId: body.categoryId || null,
      memo: body.memo || null,
    },
    include: { category: true },
  });
  return NextResponse.json(expense, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await prisma.expense.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
