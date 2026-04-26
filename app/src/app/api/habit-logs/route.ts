import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  const where: Record<string, unknown> = {};
  if (date) {
    where.date = new Date(date);
  } else if (startDate && endDate) {
    where.date = { gte: new Date(startDate), lte: new Date(endDate) };
  }

  const logs = await prisma.habitLog.findMany({
    where,
    include: { habit: true },
    orderBy: { date: "desc" },
    take: 1000,
  });
  return NextResponse.json(logs);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const log = await prisma.habitLog.upsert({
    where: { date_habitId: { date: new Date(body.date), habitId: body.habitId } },
    update: { level: body.level },
    create: { date: new Date(body.date), habitId: body.habitId, level: body.level },
  });
  return NextResponse.json(log, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await prisma.habitLog.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
