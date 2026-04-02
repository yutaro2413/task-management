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
      color: body.color || "#6b7280",
      icon: body.icon || "default",
      sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
    },
  });
  return NextResponse.json(category, { status: 201 });
}

export async function PUT(request: NextRequest) {
  const body = await request.json();

  // Reorder
  if (body.reorder && Array.isArray(body.ids)) {
    const updates = body.ids.map((id: string, index: number) =>
      prisma.expenseCategory.update({ where: { id }, data: { sortOrder: index } })
    );
    await prisma.$transaction(updates);
    return NextResponse.json({ success: true });
  }

  const data: Record<string, unknown> = {};
  if (body.name !== undefined) data.name = body.name;
  if (body.color !== undefined) data.color = body.color;
  if (body.icon !== undefined) data.icon = body.icon;

  const category = await prisma.expenseCategory.update({
    where: { id: body.id },
    data,
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
