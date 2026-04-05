import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const categories = await prisma.category.findMany({
    orderBy: { sortOrder: "asc" },
  });
  return NextResponse.json(categories);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const maxOrder = await prisma.category.aggregate({ _max: { sortOrder: true } });
  const category = await prisma.category.create({
    data: {
      name: body.name,
      sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
    },
  });
  return NextResponse.json(category, { status: 201 });
}

export async function PUT(request: NextRequest) {
  const body = await request.json();

  // Reorder support
  if (body.reorder && Array.isArray(body.ids)) {
    const updates = body.ids.map((id: string, index: number) =>
      prisma.category.update({ where: { id }, data: { sortOrder: index } })
    );
    await prisma.$transaction(updates);
    return NextResponse.json({ success: true });
  }

  const category = await prisma.category.update({
    where: { id: body.id },
    data: {
      name: body.name,
      ...(typeof body.excludeFromSummary === "boolean" && { excludeFromSummary: body.excludeFromSummary }),
    },
  });
  return NextResponse.json(category);
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await prisma.category.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
