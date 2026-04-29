import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// 後方互換ラッパー。HobbyPage の既存 datalist を壊さないために残しているが、
// 内部では新スキーマの Book にも同名レコードを upsert して移行を進める。

export async function GET() {
  const books = await prisma.bookTitle.findMany({
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(books);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  if (!body.title) return NextResponse.json({ error: "title required" }, { status: 400 });

  const [bookTitle] = await Promise.all([
    prisma.bookTitle.upsert({
      where: { title: body.title },
      update: {},
      create: { title: body.title },
    }),
    // 新スキーマにも反映（asin が無いタイトル一致のみ）
    (async () => {
      const existing = await prisma.book.findFirst({ where: { title: body.title, asin: null } });
      if (!existing) {
        await prisma.book.create({ data: { title: body.title, source: "paper" } });
      }
    })(),
  ]);
  return NextResponse.json(bookTitle, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await prisma.bookTitle.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
