import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  const where: Record<string, unknown> = {};
  if (date) {
    where.date = new Date(date);
  } else if (startDate && endDate) {
    where.date = { gte: new Date(startDate), lte: new Date(endDate) };
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
      date: new Date(body.date),
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

export async function PUT(request: NextRequest) {
  const body = await request.json();
  const expense = await prisma.expense.update({
    where: { id: body.id },
    data: {
      date: new Date(body.date),
      amount: body.amount,
      type: body.type || "expense",
      categoryId: body.categoryId || null,
      memo: body.memo || null,
    },
    include: { category: true },
  });
  return NextResponse.json(expense);
}
