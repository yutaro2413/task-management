import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const items = await prisma.fixedExpense.findMany({
    where: { active: true },
    include: { category: true },
    orderBy: { sortOrder: "asc" },
  });
  return NextResponse.json(items);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const count = await prisma.fixedExpense.count();
  const item = await prisma.fixedExpense.create({
    data: {
      title: body.title,
      amount: body.amount,
      type: body.type || "expense",
      categoryId: body.categoryId || null,
      day: body.day || 1,
      sortOrder: count,
    },
    include: { category: true },
  });
  return NextResponse.json(item, { status: 201 });
}

export async function PUT(request: NextRequest) {
  const body = await request.json();

  if (body.reorder && body.ids) {
    await Promise.all(
      body.ids.map((id: string, i: number) =>
        prisma.fixedExpense.update({ where: { id }, data: { sortOrder: i } })
      )
    );
    return NextResponse.json({ success: true });
  }

  const item = await prisma.fixedExpense.update({
    where: { id: body.id },
    data: {
      title: body.title,
      amount: body.amount,
      type: body.type,
      categoryId: body.categoryId || null,
      day: body.day,
    },
    include: { category: true },
  });
  return NextResponse.json(item);
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await prisma.fixedExpense.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
