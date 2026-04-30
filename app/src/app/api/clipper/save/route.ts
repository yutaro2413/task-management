import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkSyncToken, syncCorsHeaders } from "@/lib/syncAuth";
import { normalizeUrl, makeSelectionExternalId } from "@/lib/clipper";

const corsHeaders = syncCorsHeaders;

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

type SavePayload = {
  url: string;
  title?: string;
  excerpt?: string;
  siteName?: string;
  publishedAt?: string;
  // ハイライト (任意)。複数選択をまとめて送れる。
  selections?: { text: string; note?: string }[];
};

// POST /api/clipper/save
//   1. URL で Book(source="web") を upsert
//   2. selections があれば各選択範囲を Highlight として upsert (重複排除あり)
export async function POST(request: NextRequest) {
  const auth = checkSyncToken(request);
  if (!auth.ok) {
    return NextResponse.json(auth.body, { status: auth.status, headers: corsHeaders });
  }

  let body: SavePayload;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400, headers: corsHeaders });
  }

  if (!body.url || typeof body.url !== "string") {
    return NextResponse.json({ error: "url required" }, { status: 400, headers: corsHeaders });
  }

  const url = normalizeUrl(body.url);
  const title = (body.title || url).trim().slice(0, 500);

  // Book を URL で upsert (URL は @unique)
  const book = await prisma.book.upsert({
    where: { url },
    update: {
      // 既存値があれば触らない (ユーザー編集を保護)
      title: undefined,
      excerpt: undefined,
      siteName: undefined,
      publishedAt: undefined,
    },
    create: {
      title,
      url,
      source: "web",
      excerpt: body.excerpt?.trim().slice(0, 1000) || null,
      siteName: body.siteName?.trim().slice(0, 200) || null,
      publishedAt: body.publishedAt ? new Date(body.publishedAt) : null,
    },
  });

  // 選択範囲を Highlight として保存。テキスト内容のハッシュを externalId にして冪等。
  const upserted: { id: string; created: boolean }[] = [];
  for (const sel of body.selections ?? []) {
    if (!sel.text || !sel.text.trim()) continue;
    const externalId = makeSelectionExternalId(sel.text);
    const existing = await prisma.highlight.findUnique({
      where: { bookId_externalId: { bookId: book.id, externalId } },
    });
    if (existing) {
      // 既存ハイライトがあれば note のみ更新 (note が新規に渡されたとき)
      if (sel.note && sel.note !== existing.note) {
        await prisma.highlight.update({
          where: { id: existing.id },
          data: { note: sel.note },
        });
      }
      upserted.push({ id: existing.id, created: false });
    } else {
      const created = await prisma.highlight.create({
        data: {
          bookId: book.id,
          externalId,
          type: "text",
          text: sel.text.trim(),
          note: sel.note?.trim() || null,
          color: "yellow",
          highlightedAt: new Date(),
        },
      });
      upserted.push({ id: created.id, created: true });
    }
  }

  return NextResponse.json(
    {
      book: { id: book.id, title: book.title, url: book.url, source: book.source },
      highlights: upserted,
      created: upserted.filter((h) => h.created).length,
      existed: upserted.filter((h) => !h.created).length,
    },
    { headers: corsHeaders },
  );
}
