import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const genres = await prisma.genre.findMany({
    orderBy: { sortOrder: "asc" },
  });
  return NextResponse.json(genres);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const maxOrder = await prisma.genre.aggregate({ _max: { sortOrder: true } });
  const genre = await prisma.genre.create({
    data: {
      name: body.name,
      color: body.color || "#6366f1",
      type: body.type || "経費",
      subType: body.subType ?? "",
      sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
    },
  });
  return NextResponse.json(genre, { status: 201 });
}

export async function PUT(request: NextRequest) {
  const body = await request.json();

  // Reorder support
  if (body.reorder && Array.isArray(body.ids)) {
    const updates = body.ids.map((id: string, index: number) =>
      prisma.genre.update({ where: { id }, data: { sortOrder: index } })
    );
    await prisma.$transaction(updates);
    return NextResponse.json({ success: true });
  }

  const genre = await prisma.genre.update({
    where: { id: body.id },
    data: { name: body.name, color: body.color, type: body.type, subType: body.subType ?? "" },
  });
  return NextResponse.json(genre);
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await prisma.genre.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
