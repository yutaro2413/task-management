import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeWeights, type MenuWeight } from "@/lib/menuWeights";

// 運動の記録内容を筋トレメニューマスタへ書き戻す。
// partial-safe: 各メニューを読み込んで weights[locationId] を upsert し、
// defaultReps/defaultSets/tryHeavierNext を更新する。
// locationId が無い場合 (場所未登録・場所なしの過去ログ) は defaultWeight を更新する。
//
// 同じ menuId が複数行ある場合は、数値として最も重い weight の行をマスタへ反映する
// (回数/set もその行のものを採用、tryHeavierNext は OR)。
// tryHeavierNext は 1 件も送られてこなければ既存値を維持する。
//
// POST {
//   locationId?: string | null,
//   items: [{ menuId: string, weight: string, reps: number, sets: number, tryHeavierNext?: boolean }]
// }
export async function POST(request: NextRequest) {
  let body: {
    locationId?: string;
    items?: {
      menuId?: string;
      weight?: string;
      reps?: number;
      sets?: number;
      tryHeavierNext?: boolean;
    }[];
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const locationId = typeof body.locationId === "string" && body.locationId !== "" ? body.locationId : null;
  const items = Array.isArray(body.items) ? body.items : [];

  // 同 menuId をグルーピングし、最も重い weight の行を代表値に
  const byMenu = new Map<string, { weight: string; reps: number; sets: number; tryHeavierNext?: boolean }>();
  for (const item of items) {
    if (!item.menuId) continue;
    const weight = typeof item.weight === "string" ? item.weight : "";
    const reps = typeof item.reps === "number" ? item.reps : 0;
    const sets = typeof item.sets === "number" ? item.sets : 0;
    // 未指定 (undefined) はマスタの現在値を維持する意味なので false と区別する
    const flag = typeof item.tryHeavierNext === "boolean" ? item.tryHeavierNext : undefined;
    const cur = byMenu.get(item.menuId);
    if (!cur) {
      byMenu.set(item.menuId, { weight, reps, sets, tryHeavierNext: flag });
      continue;
    }
    const curNum = parseFloat(cur.weight);
    const newNum = parseFloat(weight);
    const heavier = !Number.isNaN(newNum) && (Number.isNaN(curNum) || newNum > curNum);
    byMenu.set(item.menuId, {
      weight: heavier ? weight : cur.weight,
      reps: heavier ? reps : cur.reps,
      sets: heavier ? sets : cur.sets,
      tryHeavierNext:
        cur.tryHeavierNext === undefined && flag === undefined
          ? undefined
          : Boolean(cur.tryHeavierNext) || Boolean(flag),
    });
  }

  let updated = 0;
  for (const [menuId, item] of byMenu) {
    const menu = await prisma.exerciseMenu.findUnique({ where: { id: menuId } });
    if (!menu || menu.type === "running") continue;

    // 場所ありなら weights[locationId]、無ければ defaultWeight を更新
    let weightPatch: { weights: MenuWeight[] } | { defaultWeight: string } | Record<string, never> = {};
    if (locationId) {
      const weights = normalizeWeights(menu.weights).filter((w) => w.locationId !== locationId);
      if (item.weight.trim() !== "") {
        weights.push({ locationId, weight: item.weight });
      }
      weightPatch = { weights };
    } else if (item.weight.trim() !== "") {
      weightPatch = { defaultWeight: item.weight };
    }

    await prisma.exerciseMenu.update({
      where: { id: menu.id },
      data: {
        ...weightPatch,
        defaultReps: item.reps > 0 ? item.reps : menu.defaultReps,
        defaultSets: item.sets > 0 ? item.sets : menu.defaultSets,
        ...(item.tryHeavierNext !== undefined ? { tryHeavierNext: item.tryHeavierNext } : {}),
      },
    });
    updated++;
  }

  return NextResponse.json({ updated });
}
