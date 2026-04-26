import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const DEDUP_SECONDS = 60;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  const where: { timestamp?: { gte?: Date; lte?: Date } } = {};
  if (startDate || endDate) {
    where.timestamp = {};
    if (startDate) where.timestamp.gte = new Date(startDate);
    if (endDate) where.timestamp.lte = new Date(endDate);
  }

  const events = await prisma.unlockEvent.findMany({
    where,
    orderBy: { timestamp: "asc" },
    take: 5000,
  });
  return NextResponse.json(events);
}

export async function POST(request: NextRequest) {
  let body: { timestamp?: string; source?: string } = {};
  try {
    const text = await request.text();
    if (text) body = JSON.parse(text);
  } catch {
    // tolerate empty/non-JSON body (iOS Shortcut may send nothing)
  }

  const ts = body.timestamp ? new Date(body.timestamp) : new Date();
  const source = body.source || "ios";

  const since = new Date(ts.getTime() - DEDUP_SECONDS * 1000);
  const recent = await prisma.unlockEvent.findFirst({
    where: { timestamp: { gte: since, lte: ts } },
    orderBy: { timestamp: "desc" },
  });
  if (recent) {
    return NextResponse.json({ deduped: true, id: recent.id }, { status: 200 });
  }

  const event = await prisma.unlockEvent.create({
    data: { timestamp: ts, source },
  });
  return NextResponse.json(event, { status: 201 });
}
