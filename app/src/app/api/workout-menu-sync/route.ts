import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeWeights } from "@/lib/menuWeights";

// 記録モーダル保存時に、当日の運動内容を筋トレメニューマスタへ書き戻す。
// partial-safe: 各メニューを読み込んで weights[locationId] を upsert し、
// defaultReps/defaultSets を更新する (既存 PUT は全フィールド送信前提のため流用しない)。
//
// POST {
//   locationId: string,
//   items: [{ menuId: string, weight: string, reps: number, sets: number }]
// }
export async function POST(request: NextRequest) {
  let body: {
    locationId?: string;
    items?: { menuId?: string; weight?: string; reps?: number; sets?: number }[];
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const locationId = body.locationId;
  if (!locationId) return NextResponse.json({ error: "locationId required" }, { status: 400 });
  const items = Array.isArray(body.items) ? body.items : [];

  let updated = 0;
  for (const item of items) {
    if (!item.menuId) continue;
    const menu = await prisma.exerciseMenu.findUnique({ where: { id: item.menuId } });
    if (!menu || menu.type === "running") continue;

    const weights = normalizeWeights(menu.weights).filter((w) => w.locationId !== locationId);
    if (typeof item.weight === "string" && item.weight.trim() !== "") {
      weights.push({ locationId, weight: item.weight });
    }
    await prisma.exerciseMenu.update({
      where: { id: menu.id },
      data: {
        weights,
        defaultReps: typeof item.reps === "number" && item.reps > 0 ? item.reps : menu.defaultReps,
        defaultSets: typeof item.sets === "number" && item.sets > 0 ? item.sets : menu.defaultSets,
      },
    });
    updated++;
  }

  return NextResponse.json({ updated });
}
