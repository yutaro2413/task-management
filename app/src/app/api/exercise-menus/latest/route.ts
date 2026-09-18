import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { deriveLatestByMenu, type WorkoutLogLike } from "@/lib/workoutPrefill";

// メニュー × 場所ごとの「直近の記録」を返す。
// 重量はマスタに持たず記録から導出するので、プリフィルはここを見る。
//
// GET /api/exercise-menus/latest?before=YYYY-MM-DD
//   before: その日「より前」の記録だけを見る (編集中の日を除くため。省略時は全件)
//
// → { [menuId]: { [locationId | ""]: { weight, reps, sets, date } } }
//   locationId が "" のキーは場所なしで記録されたログ (場所導入前の古い記録)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const before = searchParams.get("before");

  const logs = await prisma.workoutLog.findMany({
    where: before ? { date: { lt: new Date(before) } } : undefined,
    orderBy: { date: "desc" },
    select: { date: true, locationId: true, exercises: true },
    take: 1000,
  });

  const normalized: WorkoutLogLike[] = logs.map((log) => ({
    date: log.date.toISOString(),
    locationId: log.locationId,
    exercises: Array.isArray(log.exercises) ? (log.exercises as WorkoutLogLike["exercises"]) : [],
  }));

  // date < before で絞り込み済みなので deriveLatestByMenu 側の before は渡さない
  return NextResponse.json(deriveLatestByMenu(normalized));
}
