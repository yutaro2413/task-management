import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { scheduleNext, type Rating } from "@/lib/spacedRepetition";

// POST /api/reviews/[id]
// body: { rating: 0 | 1 | 2 | 3 }
// 効果:
//   - Highlight の reviewInterval / reviewEase / reviewReps / nextReviewAt / lastReviewedAt を更新
//   - HighlightReview に履歴を追加
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json();
  const rating = body.rating;
  if (![0, 1, 2, 3].includes(rating)) {
    return NextResponse.json({ error: "rating must be 0|1|2|3" }, { status: 400 });
  }

  const highlight = await prisma.highlight.findUnique({ where: { id } });
  if (!highlight) {
    return NextResponse.json({ error: "highlight not found" }, { status: 404 });
  }

  const now = new Date();
  const result = scheduleNext(
    {
      interval: highlight.reviewInterval,
      ease: highlight.reviewEase,
      reps: highlight.reviewReps,
    },
    rating as Rating,
    now,
  );

  const [updated] = await prisma.$transaction([
    prisma.highlight.update({
      where: { id },
      data: {
        reviewInterval: result.interval,
        reviewEase: result.ease,
        reviewReps: result.reps,
        nextReviewAt: result.nextReviewAt,
        lastReviewedAt: now,
      },
    }),
    prisma.highlightReview.create({
      data: {
        highlightId: id,
        rating,
        intervalDays: result.interval,
        reviewedAt: now,
      },
    }),
  ]);

  return NextResponse.json({
    highlight: updated,
    nextReviewAt: result.nextReviewAt,
    intervalDays: result.interval,
  });
}
