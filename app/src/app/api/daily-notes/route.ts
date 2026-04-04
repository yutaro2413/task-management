import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");

  if (date) {
    const note = await prisma.dailyNote.findUnique({
      where: { date: new Date(date) },
    });
    return NextResponse.json(note);
  }

  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const keyword = searchParams.get("keyword");
  const where: Record<string, unknown> = {};
  if (startDate && endDate) {
    where.date = { gte: new Date(startDate), lte: new Date(endDate) };
  }
  if (keyword) {
    where.content = { contains: keyword, mode: "insensitive" };
  }

  const notes = await prisma.dailyNote.findMany({
    where,
    orderBy: { date: "desc" },
    take: 100,
  });
  return NextResponse.json(notes);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const note = await prisma.dailyNote.upsert({
    where: { date: new Date(body.date) },
    update: { content: body.content },
    create: { date: new Date(body.date), content: body.content },
  });
  return NextResponse.json(note, { status: 201 });
}
