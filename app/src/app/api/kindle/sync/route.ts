import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { searchBookMetadata } from "@/lib/googleBooks";
import { checkSyncToken, syncCorsHeaders } from "@/lib/syncAuth";
import { computeSyncDiff } from "@/lib/syncDiff";

const corsHeaders = syncCorsHeaders;

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
  note?: string; // Kindle 側のメモ。サーバ側では kindleNote に保存。app の note は触らない。
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
  const auth = checkSyncToken(request);
  if (!auth.ok) {
    return NextResponse.json(auth.body, { status: auth.status, headers: corsHeaders });
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
  let highlightsArchived = 0;
  let highlightsRestored = 0;
  let bookmarksArchived = 0;
  let bookmarksRestored = 0;

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

    // ハイライト upsert (note は触らず kindleNote だけ更新)
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
          kindleNote: h.note ?? null,
          highlightedAt: h.highlightedAt ? new Date(h.highlightedAt) : null,
          // archived は明示復活（後の computeSyncDiff で処理する）
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
          kindleNote: h.note ?? null,
          highlightedAt: h.highlightedAt ? new Date(h.highlightedAt) : null,
        },
      });
      highlightsUpserted++;
    }

    // しおり upsert
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

    // archive 差分計算 (今回 incoming に来なかった既存項目を archive、戻ってきたものを restore)
    const incomingHighlightIds = (inc.highlights ?? []).map((h) => h.externalId).filter(Boolean) as string[];
    const incomingBookmarkIds = (inc.bookmarks ?? []).map((b) => b.externalId).filter(Boolean) as string[];

    const existingHighlights = await prisma.highlight.findMany({
      where: { bookId: book.id, externalId: { not: null } },
      select: { externalId: true, archived: true },
    });
    const hDiff = computeSyncDiff(
      incomingHighlightIds,
      existingHighlights.map((h) => ({ externalId: h.externalId!, archived: h.archived })),
    );
    if (hDiff.toArchive.length > 0) {
      const r = await prisma.highlight.updateMany({
        where: { bookId: book.id, externalId: { in: hDiff.toArchive } },
        data: { archived: true },
      });
      highlightsArchived += r.count;
    }
    if (hDiff.toRestore.length > 0) {
      const r = await prisma.highlight.updateMany({
        where: { bookId: book.id, externalId: { in: hDiff.toRestore } },
        data: { archived: false },
      });
      highlightsRestored += r.count;
    }

    const existingBookmarks = await prisma.bookmark.findMany({
      where: { bookId: book.id, externalId: { not: null } },
      select: { externalId: true, archived: true },
    });
    const bDiff = computeSyncDiff(
      incomingBookmarkIds,
      existingBookmarks.map((b) => ({ externalId: b.externalId!, archived: b.archived })),
    );
    if (bDiff.toArchive.length > 0) {
      const r = await prisma.bookmark.updateMany({
        where: { bookId: book.id, externalId: { in: bDiff.toArchive } },
        data: { archived: true },
      });
      bookmarksArchived += r.count;
    }
    if (bDiff.toRestore.length > 0) {
      const r = await prisma.bookmark.updateMany({
        where: { bookId: book.id, externalId: { in: bDiff.toRestore } },
        data: { archived: false },
      });
      bookmarksRestored += r.count;
    }
  }

  return NextResponse.json(
    {
      message: "ok",
      booksTouched,
      highlightsUpserted,
      bookmarksUpserted,
      highlightsArchived,
      highlightsRestored,
      bookmarksArchived,
      bookmarksRestored,
    },
    { headers: corsHeaders },
  );
}
