import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const book = await prisma.book.findUnique({
    where: { id },
    include: {
      series: true,
      // active のみ取得
      highlights: {
        where: { archived: false },
        orderBy: [{ page: "asc" }, { highlightedAt: "asc" }],
      },
      bookmarks: {
        where: { archived: false },
        orderBy: [{ page: "asc" }],
      },
      readingLogs: { orderBy: { date: "desc" }, take: 100 },
    },
  });
  if (!book) return NextResponse.json({ error: "not found" }, { status: 404 });

  // archived 件数も別途取得
  const [archivedHighlights, archivedBookmarks] = await Promise.all([
    prisma.highlight.findMany({
      where: { bookId: id, archived: true },
      orderBy: [{ page: "asc" }, { highlightedAt: "asc" }],
    }),
    prisma.bookmark.findMany({
      where: { bookId: id, archived: true },
      orderBy: [{ page: "asc" }],
    }),
  ]);

  return NextResponse.json({
    ...book,
    archivedHighlights,
    archivedBookmarks,
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json();
  const data: Record<string, unknown> = {};
  const allowed = [
    "title", "author", "coverUrl", "source", "asin", "isbn", "publisher",
    "rating", "seriesId", "volume", "notes", "archived",
  ] as const;
  for (const k of allowed) {
    if (k in body) data[k] = body[k];
  }
  if ("purchasedAt" in body) data.purchasedAt = body.purchasedAt ? new Date(body.purchasedAt) : null;
  if ("finishedAt" in body) data.finishedAt = body.finishedAt ? new Date(body.finishedAt) : null;

  const book = await prisma.book.update({
    where: { id },
    data,
    include: { series: true },
  });
  return NextResponse.json(book);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  await prisma.book.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
