import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { searchBookMetadata } from "@/lib/googleBooks";

// CORS（ブックマークレットは read.amazon.co.jp から fetch するため）
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Kindle-Sync-Token",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

type IncomingHighlight = {
  externalId: string;
  type?: "text" | "image" | "note";
  text?: string;
  imageUrl?: string;
  color?: string;
  location?: string;
  page?: number;
  note?: string;
  highlightedAt?: string;
};

type IncomingBookmark = {
  externalId: string;
  location?: string;
  page?: number;
  bookmarkedAt?: string;
};

type IncomingBook = {
  asin: string;
  title: string;
  author?: string;
  coverUrl?: string;
  highlights?: IncomingHighlight[];
  bookmarks?: IncomingBookmark[];
};

export async function POST(request: NextRequest) {
  const expected = process.env.KINDLE_SYNC_TOKEN;
  if (!expected) {
    return NextResponse.json(
      { error: "KINDLE_SYNC_TOKEN is not configured on the server" },
      { status: 500, headers: corsHeaders },
    );
  }
  const provided = request.headers.get("x-kindle-sync-token");
  if (provided !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: corsHeaders });
  }

  let body: { books?: IncomingBook[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400, headers: corsHeaders });
  }
  const incoming = body.books ?? [];

  let booksTouched = 0;
  let highlightsUpserted = 0;
  let bookmarksUpserted = 0;

  for (const inc of incoming) {
    if (!inc.asin || !inc.title) continue;

    // ASIN で upsert。タイトル/著者/カバーは既存値があれば尊重（ユーザー編集を保護）。
    const existing = await prisma.book.findUnique({ where: { asin: inc.asin } });
    let book = existing;
    if (!book) {
      let meta = null;
      if (!inc.author || !inc.coverUrl) {
        meta = await searchBookMetadata({ title: inc.title, author: inc.author });
      }
      book = await prisma.book.create({
        data: {
          asin: inc.asin,
          title: inc.title,
          author: inc.author ?? meta?.author ?? null,
          coverUrl: inc.coverUrl ?? meta?.coverUrl ?? null,
          publisher: meta?.publisher ?? null,
          isbn: meta?.isbn ?? null,
          source: "kindle",
        },
      });
    } else {
      // 既存 Book は不足分のみ補完（ユーザーが上書きしたフィールドは触らない）
      const data: Record<string, unknown> = {};
      if (!book.title && inc.title) data.title = inc.title;
      if (!book.author && inc.author) data.author = inc.author;
      if (!book.coverUrl && inc.coverUrl) data.coverUrl = inc.coverUrl;
      if (Object.keys(data).length > 0) {
        book = await prisma.book.update({ where: { id: book.id }, data });
      }
    }
    booksTouched++;

    for (const h of inc.highlights ?? []) {
      if (!h.externalId) continue;
      await prisma.highlight.upsert({
        where: { bookId_externalId: { bookId: book.id, externalId: h.externalId } },
        update: {
          type: h.type ?? "text",
          text: h.text ?? null,
          imageUrl: h.imageUrl ?? null,
          color: h.color ?? null,
          location: h.location ?? null,
          page: typeof h.page === "number" ? h.page : null,
          note: h.note ?? null,
          highlightedAt: h.highlightedAt ? new Date(h.highlightedAt) : null,
        },
        create: {
          bookId: book.id,
          externalId: h.externalId,
          type: h.type ?? "text",
          text: h.text ?? null,
          imageUrl: h.imageUrl ?? null,
          color: h.color ?? null,
          location: h.location ?? null,
          page: typeof h.page === "number" ? h.page : null,
          note: h.note ?? null,
          highlightedAt: h.highlightedAt ? new Date(h.highlightedAt) : null,
        },
      });
      highlightsUpserted++;
    }

    for (const b of inc.bookmarks ?? []) {
      if (!b.externalId) continue;
      await prisma.bookmark.upsert({
        where: { bookId_externalId: { bookId: book.id, externalId: b.externalId } },
        update: {
          location: b.location ?? null,
          page: typeof b.page === "number" ? b.page : null,
          bookmarkedAt: b.bookmarkedAt ? new Date(b.bookmarkedAt) : null,
        },
        create: {
          bookId: book.id,
          externalId: b.externalId,
          location: b.location ?? null,
          page: typeof b.page === "number" ? b.page : null,
          bookmarkedAt: b.bookmarkedAt ? new Date(b.bookmarkedAt) : null,
        },
      });
      bookmarksUpserted++;
    }
  }

  return NextResponse.json(
    {
      message: "ok",
      booksTouched,
      highlightsUpserted,
      bookmarksUpserted,
    },
    { headers: corsHeaders },
  );
}
