import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const habits = await prisma.habit.findMany({ orderBy: { sortOrder: "asc" } });
  return NextResponse.json(habits);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const count = await prisma.habit.count();
  const habit = await prisma.habit.create({
    data: {
      name: body.name,
      color: body.color || "#6366f1",
      level1: body.level1 || "",
      level2: body.level2 || "",
      level3: body.level3 || "",
      level4: body.level4 || "",
      level5: body.level5 || "",
      sortOrder: count,
    },
  });
  return NextResponse.json(habit, { status: 201 });
}

export async function PUT(request: NextRequest) {
  const body = await request.json();
  const habit = await prisma.habit.update({
    where: { id: body.id },
    data: {
      name: body.name,
      color: body.color,
      level1: body.level1,
      level2: body.level2,
      level3: body.level3,
      level4: body.level4,
      level5: body.level5,
      active: body.active,
    },
  });
  return NextResponse.json(habit);
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await prisma.habitLog.deleteMany({ where: { habitId: id } });
  await prisma.habit.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
