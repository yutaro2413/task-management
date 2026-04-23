import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const books = await prisma.bookTitle.findMany({
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(books);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const book = await prisma.bookTitle.upsert({
    where: { title: body.title },
    update: {},
    create: { title: body.title },
  });
  return NextResponse.json(book, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await prisma.bookTitle.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
