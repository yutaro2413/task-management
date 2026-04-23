import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  const where: Record<string, unknown> = {};
  if (date) {
    where.date = new Date(date);
  } else if (startDate && endDate) {
    where.date = { gte: new Date(startDate), lte: new Date(endDate) };
  }

  const logs = await prisma.readingLog.findMany({
    where,
    include: { bookTitle: true },
    orderBy: { date: "desc" },
    take: 200,
  });
  return NextResponse.json(logs);
}

export async function POST(request: NextRequest) {
  const body = await request.json();

  // Ensure book title exists
  const book = await prisma.bookTitle.upsert({
    where: { title: body.bookTitle },
    update: {},
    create: { title: body.bookTitle },
  });

  const log = await prisma.readingLog.upsert({
    where: { date_bookTitleId: { date: new Date(body.date), bookTitleId: book.id } },
    update: { review: body.review || null },
    create: {
      date: new Date(body.date),
      bookTitleId: book.id,
      review: body.review || null,
    },
    include: { bookTitle: true },
  });
  return NextResponse.json(log, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await prisma.readingLog.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
