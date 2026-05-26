import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const routines = await prisma.workoutRoutine.findMany({ orderBy: { sortOrder: "asc" } });
  return NextResponse.json(routines);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  if (!body.name) return NextResponse.json({ error: "name required" }, { status: 400 });
  const max = await prisma.workoutRoutine.aggregate({ _max: { sortOrder: true } });
  const routine = await prisma.workoutRoutine.create({
    data: {
      name: body.name,
      menuIds: Array.isArray(body.menuIds) ? body.menuIds : [],
      sortOrder: (max._max.sortOrder ?? -1) + 1,
    },
  });
  return NextResponse.json(routine, { status: 201 });
}

export async function PUT(request: NextRequest) {
  const body = await request.json();

  // 並び替え: { reorder: true, ids: [...] }
  if (body.reorder && Array.isArray(body.ids)) {
    await prisma.$transaction(
      body.ids.map((id: string, index: number) =>
        prisma.workoutRoutine.update({ where: { id }, data: { sortOrder: index } }),
      ),
    );
    return NextResponse.json({ success: true });
  }

  if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const data: Record<string, unknown> = {};
  if ("name" in body) data.name = body.name;
  if ("menuIds" in body && Array.isArray(body.menuIds)) data.menuIds = body.menuIds;
  const routine = await prisma.workoutRoutine.update({ where: { id: body.id }, data });
  return NextResponse.json(routine);
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await prisma.workoutRoutine.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
