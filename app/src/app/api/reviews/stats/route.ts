import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/reviews/stats
//   過去 30 日の復習件数とレーティング分布
export async function GET() {
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  since.setUTCDate(since.getUTCDate() - 30);

  const recent = await prisma.highlightReview.findMany({
    where: { reviewedAt: { gte: since } },
    select: { reviewedAt: true, rating: true },
  });

  // YYYY-MM-DD ごとに集計
  const byDay = new Map<string, { total: number; ratings: Record<number, number> }>();
  for (const r of recent) {
    const key = r.reviewedAt.toISOString().slice(0, 10);
    const cur = byDay.get(key) ?? { total: 0, ratings: { 0: 0, 1: 0, 2: 0, 3: 0 } };
    cur.total += 1;
    cur.ratings[r.rating] = (cur.ratings[r.rating] ?? 0) + 1;
    byDay.set(key, cur);
  }
  const days = Array.from(byDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, ...v }));

  const totalReviewed = await prisma.highlight.count({
    where: { reviewReps: { gt: 0 } },
  });
  const totalLearning = await prisma.highlight.count({
    where: { reviewReps: { gt: 0, lt: 3 } },
  });
  const totalMature = await prisma.highlight.count({
    where: { reviewReps: { gte: 3 } },
  });
  const totalNew = await prisma.highlight.count({ where: { reviewReps: 0 } });

  return NextResponse.json({
    days,
    totals: {
      reviewed: totalReviewed,
      learning: totalLearning,
      mature: totalMature,
      new: totalNew,
    },
  });
}
