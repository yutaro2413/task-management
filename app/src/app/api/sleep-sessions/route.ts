import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computeSleepSessions, MAX_SLEEP_GAP_HOURS } from "@/lib/sleep";

const HOUR_MS = 60 * 60 * 1000;
const BUFFER_MS = (MAX_SLEEP_GAP_HOURS + 8) * HOUR_MS;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  let rangeStart: Date;
  let rangeEnd: Date;
  if (date) {
    // Single JST day: cover that day plus buffer on both sides for gap detection.
    const d = new Date(date + "T00:00:00.000Z");
    rangeStart = new Date(d.getTime() - 9 * HOUR_MS - BUFFER_MS);
    rangeEnd = new Date(d.getTime() - 9 * HOUR_MS + 24 * HOUR_MS + BUFFER_MS);
  } else if (startDate && endDate) {
    const s = new Date(startDate + "T00:00:00.000Z");
    const e = new Date(endDate + "T00:00:00.000Z");
    rangeStart = new Date(s.getTime() - 9 * HOUR_MS - BUFFER_MS);
    rangeEnd = new Date(e.getTime() - 9 * HOUR_MS + 24 * HOUR_MS + BUFFER_MS);
  } else {
    return NextResponse.json({ error: "date or startDate/endDate required" }, { status: 400 });
  }

  const events = await prisma.unlockEvent.findMany({
    where: { timestamp: { gte: rangeStart, lte: rangeEnd } },
    orderBy: { timestamp: "asc" },
    select: { timestamp: true },
    take: 10000,
  });

  const all = computeSleepSessions(events);
  if (date) {
    const session = all.find((s) => s.date === date) || null;
    return NextResponse.json(session);
  }
  const filtered = all.filter((s) => s.date >= startDate! && s.date <= endDate!);
  return NextResponse.json(filtered);
}
