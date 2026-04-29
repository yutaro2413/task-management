import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const bookId = searchParams.get("bookId");
  if (!bookId) return NextResponse.json({ error: "bookId required" }, { status: 400 });

  const bookmarks = await prisma.bookmark.findMany({
    where: { bookId },
    orderBy: [{ page: "asc" }],
  });
  return NextResponse.json(bookmarks);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  if (!body.bookId) return NextResponse.json({ error: "bookId required" }, { status: 400 });
  const bookmark = await prisma.bookmark.create({
    data: {
      bookId: body.bookId,
      location: body.location ?? null,
      page: typeof body.page === "number" ? body.page : null,
      bookmarkedAt: body.bookmarkedAt ? new Date(body.bookmarkedAt) : null,
    },
  });
  return NextResponse.json(bookmark, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await prisma.bookmark.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
