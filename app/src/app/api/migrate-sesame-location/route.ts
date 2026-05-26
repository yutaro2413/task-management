import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeWeights, type MenuWeight } from "@/lib/menuWeights";

// 既存のジム記録はすべて「セサミ」で行われたものとして、
//   1. "セサミ" GymLocation を作成 (無ければ)
//   2. 各 ExerciseMenu の defaultWeight を weights[セサミ] にコピー (まだ無ければ)
// 冪等。何度叩いても二重登録されない。
export async function POST() {
  // 1. セサミ location を確保
  let sesame = await prisma.gymLocation.findFirst({ where: { name: "セサミ" } });
  if (!sesame) {
    const max = await prisma.gymLocation.aggregate({ _max: { sortOrder: true } });
    sesame = await prisma.gymLocation.create({
      data: { name: "セサミ", sortOrder: (max._max.sortOrder ?? -1) + 1 },
    });
  }

  // 2. 各メニューの defaultWeight を weights[セサミ] にコピー
  const menus = await prisma.exerciseMenu.findMany();
  let updated = 0;
  for (const m of menus) {
    if (m.type === "running") continue;
    const weights = normalizeWeights(m.weights);
    if (weights.some((w) => w.locationId === sesame!.id)) continue; // 既にセサミ重量がある
    if (!m.defaultWeight || m.defaultWeight.trim() === "") continue; // コピー元が無い
    const next: MenuWeight[] = [...weights, { locationId: sesame.id, weight: m.defaultWeight }];
    await prisma.exerciseMenu.update({ where: { id: m.id }, data: { weights: next } });
    updated++;
  }

  return NextResponse.json({
    message: `セサミ location: ${sesame.id}. ${updated} 件のメニューに セサミ重量をコピーしました。`,
    locationId: sesame.id,
    updatedMenus: updated,
  });
}
