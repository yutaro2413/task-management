import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computeSleepSessions, MAX_SLEEP_GAP_HOURS } from "@/lib/sleep";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const RETAIN_DAYS = 30;
const PROCESS_DAYS = 31;
const BUFFER_MS = (MAX_SLEEP_GAP_HOURS + 8) * HOUR_MS;

async function runCleanup() {
  const now = new Date();
  const cutoff = new Date(now.getTime() - RETAIN_DAYS * DAY_MS);
  const processStart = new Date(cutoff.getTime() - PROCESS_DAYS * DAY_MS - BUFFER_MS);
  const processEnd = new Date(cutoff.getTime() + BUFFER_MS);

  const events = await prisma.unlockEvent.findMany({
    where: { timestamp: { gte: processStart, lte: processEnd } },
    orderBy: { timestamp: "asc" },
    select: { timestamp: true },
    take: 50000,
  });

  const sessions = computeSleepSessions(events);

  let upserted = 0;
  for (const s of sessions) {
    const sessionDate = new Date(s.date + "T00:00:00.000Z");
    if (sessionDate > cutoff) continue;
    await prisma.sleepSession.upsert({
      where: { date: sessionDate },
      update: {
        sleepAt: new Date(s.sleepAt),
        wakeAt: new Date(s.wakeAt),
        durationMinutes: s.durationMinutes,
      },
      create: {
        date: sessionDate,
        sleepAt: new Date(s.sleepAt),
        wakeAt: new Date(s.wakeAt),
        durationMinutes: s.durationMinutes,
      },
    });
    upserted++;
  }

  const deleted = await prisma.unlockEvent.deleteMany({
    where: { timestamp: { lt: cutoff } },
  });

  return {
    cutoff: cutoff.toISOString(),
    upsertedSessions: upserted,
    deletedEvents: deleted.count,
  };
}

export async function GET() {
  const result = await runCleanup();
  return NextResponse.json(result);
}

export async function POST() {
  const result = await runCleanup();
  return NextResponse.json(result);
}
