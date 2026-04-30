import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const bookId = searchParams.get("bookId");
  if (!bookId) return NextResponse.json({ error: "bookId required" }, { status: 400 });
  const includeArchived = searchParams.get("includeArchived") === "true";
  const onlyArchived = searchParams.get("onlyArchived") === "true";

  const where: Record<string, unknown> = { bookId };
  if (onlyArchived) where.archived = true;
  else if (!includeArchived) where.archived = false;

  const highlights = await prisma.highlight.findMany({
    where,
    orderBy: [{ page: "asc" }, { highlightedAt: "asc" }],
  });
  return NextResponse.json(highlights);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  if (!body.bookId) return NextResponse.json({ error: "bookId required" }, { status: 400 });
  const highlight = await prisma.highlight.create({
    data: {
      bookId: body.bookId,
      type: body.type || "text",
      text: body.text ?? null,
      note: body.note ?? null,
      color: body.color ?? null,
      location: body.location ?? null,
      page: typeof body.page === "number" ? body.page : null,
      imageUrl: body.imageUrl ?? null,
      highlightedAt: body.highlightedAt ? new Date(body.highlightedAt) : null,
    },
  });
  return NextResponse.json(highlight, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const data: Record<string, unknown> = {};
  // note は app 側専用、kindleNote は同期で書き換わるので app からは触らない方針
  for (const k of ["text", "note", "color", "location", "page", "type", "imageUrl", "archived"] as const) {
    if (k in body) data[k] = body[k];
  }
  const highlight = await prisma.highlight.update({ where: { id: body.id }, data });
  return NextResponse.json(highlight);
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await prisma.highlight.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
