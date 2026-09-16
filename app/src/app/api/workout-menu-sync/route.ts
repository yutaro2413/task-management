import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// 記録の「↑次回up」目印をマスタへ書き戻す。
//
// 重量・回数・set はマスタに持たず記録から導出するので、ここでは同期しない
// (/api/exercise-menus/latest が記録を直接読む)。
// tryHeavierNext だけは「次にやる時の意図」でありどの記録にも属さないため、
// マスタ側に置いて記録保存時に同期する。
//
// POST { items: [{ menuId: string, tryHeavierNext: boolean }] }
export async function POST(request: NextRequest) {
  let body: { items?: { menuId?: string; tryHeavierNext?: boolean }[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const items = Array.isArray(body.items) ? body.items : [];

  // 同じ menuId が複数行ある場合、1 行でも立っていれば立てる
  const byMenu = new Map<string, boolean>();
  for (const item of items) {
    if (!item.menuId || typeof item.tryHeavierNext !== "boolean") continue;
    byMenu.set(item.menuId, (byMenu.get(item.menuId) ?? false) || item.tryHeavierNext);
  }

  let updated = 0;
  for (const [menuId, tryHeavierNext] of byMenu) {
    const menu = await prisma.exerciseMenu.findUnique({ where: { id: menuId } });
    if (!menu || menu.type === "running" || menu.tryHeavierNext === tryHeavierNext) continue;
    await prisma.exerciseMenu.update({ where: { id: menuId }, data: { tryHeavierNext } });
    updated++;
  }

  return NextResponse.json({ updated });
}
