import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const series = await prisma.bookSeries.findMany({
    include: { _count: { select: { books: true } } },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(series);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  if (!body.name) return NextResponse.json({ error: "name required" }, { status: 400 });
  const series = await prisma.bookSeries.upsert({
    where: { name: body.name },
    update: {
      author: body.author ?? undefined,
      coverUrl: body.coverUrl ?? undefined,
    },
    create: {
      name: body.name,
      author: body.author ?? null,
      coverUrl: body.coverUrl ?? null,
    },
  });
  return NextResponse.json(series, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const series = await prisma.bookSeries.update({
    where: { id: body.id },
    data: {
      name: body.name,
      author: body.author ?? null,
      coverUrl: body.coverUrl ?? null,
    },
  });
  return NextResponse.json(series);
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  // 紐づく Book の seriesId を null に戻してから削除
  await prisma.book.updateMany({ where: { seriesId: id }, data: { seriesId: null } });
  await prisma.bookSeries.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
