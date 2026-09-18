import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeWeights } from "@/lib/menuWeights";
import { normalizeLocationIds } from "@/lib/workoutPrefill";

// 旧 weights ([{ locationId, weight }]) から locationIds を作る 1 回限りの移行。
// 「重量が入っている場所 = その種目ができる場所」として扱う。
// 重量そのものは WorkoutLog から導出するので移行不要 (記録側に既にある)。
//
// 冪等: locationIds が既に入っているメニューはスキップする。
export async function POST() {
  const menus = await prisma.exerciseMenu.findMany();

  let migrated = 0;
  const skipped: string[] = [];
  for (const menu of menus) {
    if (normalizeLocationIds(menu.locationIds).length > 0) {
      skipped.push(menu.name);
      continue;
    }
    const locationIds = normalizeWeights(menu.weights)
      .filter((w) => w.weight.trim() !== "")
      .map((w) => w.locationId);
    if (locationIds.length === 0) {
      // 重量未設定のメニューは「場所を限定しない」(= どこでも出す) のままにする
      skipped.push(menu.name);
      continue;
    }
    await prisma.exerciseMenu.update({
      where: { id: menu.id },
      data: { locationIds: normalizeLocationIds(locationIds) },
    });
    migrated++;
  }

  return NextResponse.json({ migrated, skipped });
}
