import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeLocationIds } from "@/lib/workoutPrefill";

// 筋トレメニューのマスタ。
// default* はその種目の記録がまだ無い時の初期値としてだけ使う。
// 記録がある場合は /api/exercise-menus/latest 側 (= 記録) が優先される。

export async function GET() {
  const menus = await prisma.exerciseMenu.findMany({
    orderBy: { sortOrder: "asc" },
  });
  return NextResponse.json(menus);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const maxOrder = await prisma.exerciseMenu.aggregate({ _max: { sortOrder: true } });
  const menu = await prisma.exerciseMenu.create({
    data: {
      name: body.name,
      note: typeof body.note === "string" ? body.note : "",
      locationIds: normalizeLocationIds(body.locationIds),
      defaultWeight: typeof body.defaultWeight === "string" ? body.defaultWeight : "",
      defaultReps: body.defaultReps ?? 10,
      defaultSets: body.defaultSets ?? 3,
      type: body.type || "strength",
      sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
    },
  });
  return NextResponse.json(menu, { status: 201 });
}

export async function PUT(request: NextRequest) {
  const body = await request.json();

  // Reorder support: { reorder: true, ids: [...] } で sortOrder を一括更新
  if (body.reorder && Array.isArray(body.ids)) {
    const updates = body.ids.map((id: string, index: number) =>
      prisma.exerciseMenu.update({ where: { id }, data: { sortOrder: index } })
    );
    await prisma.$transaction(updates);
    return NextResponse.json({ success: true });
  }

  const menu = await prisma.exerciseMenu.update({
    where: { id: body.id },
    data: {
      name: body.name,
      ...("note" in body ? { note: typeof body.note === "string" ? body.note : "" } : {}),
      ...("locationIds" in body ? { locationIds: normalizeLocationIds(body.locationIds) } : {}),
      ...("defaultWeight" in body
        ? { defaultWeight: typeof body.defaultWeight === "string" ? body.defaultWeight : "" }
        : {}),
      defaultReps: body.defaultReps ?? 10,
      defaultSets: body.defaultSets ?? 3,
      type: body.type || "strength",
      ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder } : {}),
    },
  });
  return NextResponse.json(menu);
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await prisma.exerciseMenu.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
