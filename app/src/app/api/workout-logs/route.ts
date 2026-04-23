import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  if (date) {
    const log = await prisma.workoutLog.findUnique({
      where: { date: new Date(date) },
    });
    return NextResponse.json(log);
  }

  const where: Record<string, unknown> = {};
  if (startDate && endDate) {
    where.date = { gte: new Date(startDate), lte: new Date(endDate) };
  }

  const logs = await prisma.workoutLog.findMany({
    where,
    orderBy: { date: "desc" },
    take: 200,
  });
  return NextResponse.json(logs);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const log = await prisma.workoutLog.upsert({
    where: { date: new Date(body.date) },
    update: { exercises: body.exercises },
    create: { date: new Date(body.date), exercises: body.exercises },
  });
  return NextResponse.json(log, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");
  if (!date) return NextResponse.json({ error: "date required" }, { status: 400 });
  await prisma.workoutLog.deleteMany({ where: { date: new Date(date) } });
  return NextResponse.json({ success: true });
}
