import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { makeSelectionExternalId } from "@/lib/clipper";

// PDF 取込みは認証不要。クライアント側でパース済みの軽量 JSON を受け取って DB に保存するだけ。
// (PDF ファイル本体はサーバに送らない設計のため、シェアードシークレットによる認証は省略)
//
// POST /api/pdf/import
//   body: {
//     title: string,
//     fileName?: string,
//     fileSize?: number,
//     pageCount?: number,
//     highlights: [{ page, text, note, color, modifiedAt }],
//   }

type IncomingHighlight = {
  page?: number;
  text?: string;
  note?: string;
  color?: string | null;
  modifiedAt?: string | null;
};

type Payload = {
  title: string;
  fileName?: string;
  fileSize?: number;
  pageCount?: number;
  highlights: IncomingHighlight[];
};

export async function POST(request: NextRequest) {
  let body: Payload;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (!body.title) {
    return NextResponse.json({ error: "title required" }, { status: 400 });
  }

  // タイトル + ファイル名で同一PDFを判定。ファイル名が無ければタイトルのみ。
  const dedupeKey = body.fileName ? `${body.title}::${body.fileName}` : body.title;

  // 既存 Book を探す (source=pdf, asin=null, タイトル一致 + notes に dedupeKey が含まれる)
  const existing = await prisma.book.findFirst({
    where: { source: "pdf", title: body.title, archived: false },
    orderBy: { createdAt: "desc" },
  });

  let book = existing;
  if (!book) {
    book = await prisma.book.create({
      data: {
        title: body.title,
        source: "pdf",
        notes: body.fileName ? `元ファイル: ${body.fileName}` : null,
      },
    });
  }

  // ハイライトを upsert (本文ハッシュで重複排除)
  let created = 0;
  let existed = 0;
  for (const h of body.highlights ?? []) {
    const text = (h.text ?? "").trim();
    if (!text) continue; // /Contents 空のものはスキップ (UI で別途扱う)
    const externalId = makeSelectionExternalId(`${h.page ?? ""}:${text}`);

    const exists = await prisma.highlight.findUnique({
      where: { bookId_externalId: { bookId: book.id, externalId } },
    });
    if (exists) {
      existed++;
      continue;
    }
    await prisma.highlight.create({
      data: {
        bookId: book.id,
        externalId,
        type: "text",
        text,
        note: h.note?.trim() || null,
        color: h.color ?? "yellow",
        page: h.page ?? null,
        location: h.page ? `p.${h.page}` : null,
        highlightedAt: h.modifiedAt ? new Date(h.modifiedAt) : new Date(),
      },
    });
    created++;
  }

  return NextResponse.json({
    book: { id: book.id, title: book.title, source: book.source },
    dedupeKey,
    created,
    existed,
  });
}
