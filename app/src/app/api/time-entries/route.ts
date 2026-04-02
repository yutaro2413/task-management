import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const categoryId = searchParams.get("categoryId");
  const genreId = searchParams.get("genreId");
  const keyword = searchParams.get("keyword");

  const where: Record<string, unknown> = {};
  if (date) {
    where.date = new Date(date);
  } else if (startDate && endDate) {
    where.date = { gte: new Date(startDate), lte: new Date(endDate) };
  }
  if (categoryId) where.categoryId = categoryId;
  if (genreId) where.genreId = genreId;
  if (keyword) {
    where.OR = [
      { title: { contains: keyword, mode: "insensitive" } },
      { detail: { contains: keyword, mode: "insensitive" } },
    ];
  }

  const entries = await prisma.timeEntry.findMany({
    where,
    include: { category: true, genre: true },
    orderBy: [{ date: "asc" }, { startSlot: "asc" }],
  });
  return NextResponse.json(entries);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const entry = await prisma.timeEntry.create({
    data: {
      date: new Date(body.date),
      startSlot: body.startSlot,
      endSlot: body.endSlot,
      categoryId: body.categoryId,
      genreId: body.genreId,
      title: body.title || null,
      detail: body.detail || null,
    },
    include: { category: true, genre: true },
  });
  return NextResponse.json(entry, { status: 201 });
}

export async function PUT(request: NextRequest) {
  const body = await request.json();
  const entry = await prisma.timeEntry.update({
    where: { id: body.id },
    data: {
      startSlot: body.startSlot,
      endSlot: body.endSlot,
      categoryId: body.categoryId,
      genreId: body.genreId,
      title: body.title || null,
      detail: body.detail || null,
    },
    include: { category: true, genre: true },
  });
  return NextResponse.json(entry);
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await prisma.timeEntry.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
