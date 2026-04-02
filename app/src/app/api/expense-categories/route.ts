import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const categories = await prisma.expenseCategory.findMany({
    orderBy: { sortOrder: "asc" },
  });
  return NextResponse.json(categories);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const maxOrder = await prisma.expenseCategory.aggregate({ _max: { sortOrder: true } });
  const category = await prisma.expenseCategory.create({
    data: {
      name: body.name,
      sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
    },
  });
  return NextResponse.json(category, { status: 201 });
}

export async function PUT(request: NextRequest) {
  const body = await request.json();
  const category = await prisma.expenseCategory.update({
    where: { id: body.id },
    data: { name: body.name },
  });
  return NextResponse.json(category);
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await prisma.expenseCategory.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
