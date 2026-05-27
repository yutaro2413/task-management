import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// 既存の筋トレ記録 (WorkoutLog) はすべて「セサミ」で行われたものとして、
// locationId が未設定のログに セサミ GymLocation の id を埋める。
// 冪等。何度叩いても既に設定済みのログは触らない。
export async function POST() {
  const sesame = await prisma.gymLocation.findFirst({ where: { name: "セサミ" } });
  if (!sesame) {
    return NextResponse.json(
      { error: "セサミ location が見つかりません。先に /api/migrate-sesame-location を実行してください。" },
      { status: 400 },
    );
  }

  const { count } = await prisma.workoutLog.updateMany({
    where: { locationId: null },
    data: { locationId: sesame.id },
  });

  return NextResponse.json({
    message: `${count} 件の WorkoutLog を セサミ (${sesame.id}) に移行しました。`,
    locationId: sesame.id,
    updatedLogs: count,
  });
}
