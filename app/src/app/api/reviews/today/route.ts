import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/reviews/today
//   ?limit=10    返却する最大件数 (default 10, max 50)
//   ?seed=42     ランダム抽出のための seed (任意)
// 返却:
//   {
//     dueCount:  期限切れ + 当日分の件数
//     newCount:  未学習ハイライトの件数
//     queue:     [{ ...highlight, book: {id, title, coverUrl, source} }]
//   }
//
// queue の選び方:
//   1. nextReviewAt <= 今日 のハイライト (期限切れ・当日分) を優先
//   2. 足りなければ未学習 (nextReviewAt = null) からランダム補充
//   3. 合計 limit 件まで
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit") ?? "10")));

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  // 当日 23:59 まで
  const endOfToday = new Date(today);
  endOfToday.setUTCDate(endOfToday.getUTCDate() + 1);

  const include = {
    book: { select: { id: true, title: true, coverUrl: true, source: true, author: true } },
  } as const;

  const due = await prisma.highlight.findMany({
    where: { nextReviewAt: { lt: endOfToday } },
    include,
    orderBy: [{ nextReviewAt: "asc" }],
    take: limit,
  });

  const dueCount = await prisma.highlight.count({
    where: { nextReviewAt: { lt: endOfToday } },
  });
  const newCount = await prisma.highlight.count({
    where: { nextReviewAt: null },
  });

  let queue = due;
  if (queue.length < limit) {
    // 未学習からランダム抽出して補充。Postgres の RANDOM() で順序付け。
    const fillCount = limit - queue.length;
    const fresh = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM "Highlight"
      WHERE "nextReviewAt" IS NULL
      ORDER BY RANDOM()
      LIMIT ${fillCount}
    `;
    if (fresh.length > 0) {
      const freshHighlights = await prisma.highlight.findMany({
        where: { id: { in: fresh.map((f) => f.id) } },
        include,
      });
      queue = [...queue, ...freshHighlights];
    }
  }

  return NextResponse.json({ dueCount, newCount, queue });
}
