import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const menus = await prisma.exerciseMenu.findMany({
    orderBy: { sortOrder: "asc" },
  });
  return NextResponse.json(menus);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const maxOrder = await prisma.exerciseMenu.aggregate({ _max: { sortOrder: true } });
  const menu = await prisma.exerciseMenu.create({
    data: {
      name: body.name,
      defaultWeight: body.defaultWeight || "",
      defaultReps: body.defaultReps ?? 10,
      defaultSets: body.defaultSets ?? 3,
      type: body.type || "strength",
      sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
    },
  });
  return NextResponse.json(menu, { status: 201 });
}

export async function PUT(request: NextRequest) {
  const body = await request.json();
  const menu = await prisma.exerciseMenu.update({
    where: { id: body.id },
    data: {
      name: body.name,
      defaultWeight: body.defaultWeight || "",
      defaultReps: body.defaultReps ?? 10,
      defaultSets: body.defaultSets ?? 3,
      type: body.type || "strength",
      ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder } : {}),
    },
  });
  return NextResponse.json(menu);
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await prisma.exerciseMenu.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
