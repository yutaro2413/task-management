import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { searchBookMetadata } from "@/lib/googleBooks";

// Google Books API で著者・カバー・出版社・ISBN を再取得して上書き保存。
// ユーザーが編集済みのフィールドは上書きしない（null/空のものだけ埋める）モードと、
// 強制上書きモードを ?force=1 で切り替え。
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const force = new URL(request.url).searchParams.get("force") === "1";

  const book = await prisma.book.findUnique({ where: { id } });
  if (!book) return NextResponse.json({ error: "not found" }, { status: 404 });

  const meta = await searchBookMetadata({
    isbn: book.isbn ?? undefined,
    title: book.title,
    author: book.author ?? undefined,
  });
  if (!meta) {
    return NextResponse.json({ message: "no metadata found", updated: false }, { status: 200 });
  }

  const data: Record<string, unknown> = {};
  if (meta.author && (force || !book.author)) data.author = meta.author;
  if (meta.coverUrl && (force || !book.coverUrl)) data.coverUrl = meta.coverUrl;
  if (meta.publisher && (force || !book.publisher)) data.publisher = meta.publisher;
  if (meta.isbn && (force || !book.isbn)) data.isbn = meta.isbn;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ message: "nothing to update", updated: false });
  }

  const updated = await prisma.book.update({ where: { id }, data });
  return NextResponse.json({ message: "updated", updated: true, book: updated });
}
