import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const bookId = searchParams.get("bookId");

  const where: Record<string, unknown> = {};
  if (date) {
    where.date = new Date(date);
  } else if (startDate && endDate) {
    where.date = { gte: new Date(startDate), lte: new Date(endDate) };
  }
  if (bookId) where.bookId = bookId;

  const logs = await prisma.readingLog.findMany({
    where,
    include: { bookTitle: true, book: true },
    orderBy: { date: "desc" },
    take: 200,
  });
  return NextResponse.json(logs);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  // bookId 直指定（新フロー）
  if (body.bookId) {
    const log = await prisma.readingLog.upsert({
      where: { date_bookId: { date: new Date(body.date), bookId: body.bookId } },
      update: { review: body.review ?? null },
      create: {
        date: new Date(body.date),
        bookId: body.bookId,
        review: body.review ?? null,
      },
      include: { bookTitle: true, book: true },
    });
    return NextResponse.json(log, { status: 201 });
  }

  // 旧 API：タイトル文字列で upsert（HobbyPage 既存呼び出し）
  if (!body.bookTitle) {
    return NextResponse.json({ error: "bookTitle or bookId required" }, { status: 400 });
  }
  const bookTitle = await prisma.bookTitle.upsert({
    where: { title: body.bookTitle },
    update: {},
    create: { title: body.bookTitle },
  });
  // 新 Book も並列 upsert（同一タイトル・asin null）
  let newBook = await prisma.book.findFirst({ where: { title: body.bookTitle, asin: null } });
  if (!newBook) {
    newBook = await prisma.book.create({ data: { title: body.bookTitle, source: "paper" } });
  }

  const log = await prisma.readingLog.upsert({
    where: { date_bookTitleId: { date: new Date(body.date), bookTitleId: bookTitle.id } },
    update: { review: body.review ?? null, bookId: newBook.id },
    create: {
      date: new Date(body.date),
      bookTitleId: bookTitle.id,
      bookId: newBook.id,
      review: body.review ?? null,
    },
    include: { bookTitle: true, book: true },
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
