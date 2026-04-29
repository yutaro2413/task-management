import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { searchBookMetadata } from "@/lib/googleBooks";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const source = searchParams.get("source"); // "kindle" | "paper" | "manga"
  const seriesId = searchParams.get("seriesId");
  const search = searchParams.get("search");
  const archived = searchParams.get("archived") === "true";

  const where: Record<string, unknown> = { archived };
  if (source) where.source = source;
  if (seriesId) where.seriesId = seriesId;
  if (search) where.title = { contains: search, mode: "insensitive" };

  const books = await prisma.book.findMany({
    where,
    include: {
      series: true,
      _count: { select: { highlights: true, bookmarks: true, readingLogs: true } },
    },
    orderBy: [{ updatedAt: "desc" }],
    take: 500,
  });
  return NextResponse.json(books);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  if (!body.title || typeof body.title !== "string") {
    return NextResponse.json({ error: "title required" }, { status: 400 });
  }
  const source: string = body.source || "paper";

  // Google Books でメタを補完（無くても続行）
  let meta = null;
  if (!body.author || !body.coverUrl) {
    meta = await searchBookMetadata({
      isbn: body.isbn,
      title: body.title,
      author: body.author,
    });
  }

  const book = await prisma.book.create({
    data: {
      title: body.title,
      author: body.author ?? meta?.author ?? null,
      coverUrl: body.coverUrl ?? meta?.coverUrl ?? null,
      source,
      asin: body.asin ?? null,
      isbn: body.isbn ?? meta?.isbn ?? null,
      publisher: body.publisher ?? meta?.publisher ?? null,
      rating: typeof body.rating === "number" ? body.rating : null,
      purchasedAt: body.purchasedAt ? new Date(body.purchasedAt) : null,
      finishedAt: body.finishedAt ? new Date(body.finishedAt) : null,
      seriesId: body.seriesId ?? null,
      volume: typeof body.volume === "number" ? body.volume : null,
      notes: body.notes ?? null,
    },
    include: { series: true },
  });
  return NextResponse.json(book, { status: 201 });
}
