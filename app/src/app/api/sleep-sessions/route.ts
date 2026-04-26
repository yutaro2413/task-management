import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computeSleepSessions, MAX_SLEEP_GAP_HOURS, type SleepSession } from "@/lib/sleep";

const HOUR_MS = 60 * 60 * 1000;
const BUFFER_MS = (MAX_SLEEP_GAP_HOURS + 8) * HOUR_MS;

function dateKeyFromDb(d: Date): string {
  // SleepSession.date is @db.Date — Postgres returns 00:00 UTC; format as YYYY-MM-DD.
  return d.toISOString().split("T")[0];
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  let rangeStart: Date;
  let rangeEnd: Date;
  let dateLo: string;
  let dateHi: string;
  if (date) {
    const d = new Date(date + "T00:00:00.000Z");
    rangeStart = new Date(d.getTime() - 9 * HOUR_MS - BUFFER_MS);
    rangeEnd = new Date(d.getTime() - 9 * HOUR_MS + 24 * HOUR_MS + BUFFER_MS);
    dateLo = date;
    dateHi = date;
  } else if (startDate && endDate) {
    const s = new Date(startDate + "T00:00:00.000Z");
    const e = new Date(endDate + "T00:00:00.000Z");
    rangeStart = new Date(s.getTime() - 9 * HOUR_MS - BUFFER_MS);
    rangeEnd = new Date(e.getTime() - 9 * HOUR_MS + 24 * HOUR_MS + BUFFER_MS);
    dateLo = startDate;
    dateHi = endDate;
  } else {
    return NextResponse.json({ error: "date or startDate/endDate required" }, { status: 400 });
  }

  const [persisted, events] = await Promise.all([
    prisma.sleepSession.findMany({
      where: { date: { gte: new Date(dateLo + "T00:00:00.000Z"), lte: new Date(dateHi + "T00:00:00.000Z") } },
      orderBy: { date: "asc" },
    }),
    prisma.unlockEvent.findMany({
      where: { timestamp: { gte: rangeStart, lte: rangeEnd } },
      orderBy: { timestamp: "asc" },
      select: { timestamp: true },
      take: 10000,
    }),
  ]);

  const dynamic = computeSleepSessions(events);
  const merged = new Map<string, SleepSession>();
  for (const s of dynamic) {
    if (s.date < dateLo || s.date > dateHi) continue;
    merged.set(s.date, s);
  }
  // Persisted (確定済み) takes precedence over dynamic for the same date
  for (const p of persisted) {
    const key = dateKeyFromDb(p.date);
    merged.set(key, {
      date: key,
      sleepAt: p.sleepAt.toISOString(),
      wakeAt: p.wakeAt.toISOString(),
      durationMinutes: p.durationMinutes,
    });
  }

  const result = Array.from(merged.values()).sort((a, b) => a.date.localeCompare(b.date));

  if (date) {
    return NextResponse.json(result.find((s) => s.date === date) || null);
  }
  return NextResponse.json(result);
}
