import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const locations = await prisma.gymLocation.findMany({ orderBy: { sortOrder: "asc" } });
  return NextResponse.json(locations);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  if (!body.name) return NextResponse.json({ error: "name required" }, { status: 400 });
  const max = await prisma.gymLocation.aggregate({ _max: { sortOrder: true } });
  const location = await prisma.gymLocation.create({
    data: { name: body.name, sortOrder: (max._max.sortOrder ?? -1) + 1 },
  });
  return NextResponse.json(location, { status: 201 });
}

export async function PUT(request: NextRequest) {
  const body = await request.json();

  // 並び替え: { reorder: true, ids: [...] }
  if (body.reorder && Array.isArray(body.ids)) {
    await prisma.$transaction(
      body.ids.map((id: string, index: number) =>
        prisma.gymLocation.update({ where: { id }, data: { sortOrder: index } }),
      ),
    );
    return NextResponse.json({ success: true });
  }

  if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const location = await prisma.gymLocation.update({
    where: { id: body.id },
    data: { name: body.name },
  });
  return NextResponse.json(location);
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await prisma.gymLocation.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
