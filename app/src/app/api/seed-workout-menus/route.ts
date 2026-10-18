import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// ダンベル中心のメニュー一式を登録する (一回限り)。
// default* は「その種目の記録がまだ無い時の初期値」なので、
// 一度記録すれば以降はその場所での直近の記録が引き継がれる。
//
// 冪等: 同名のメニューが既にあればスキップする。
// locationIds は空 (= 全ての場所に出る)。絞り込みは設定画面の「できる場所」から。
const MENUS: {
  name: string;
  note: string;
  defaultWeight: string;
  defaultReps: number;
  defaultSets: number;
}[] = [
  {
    name: "ダンベルスクワット",
    note: "",
    defaultWeight: "10",
    defaultReps: 10,
    defaultSets: 3,
  },
  {
    name: "ダンベルプレス（ワイド）",
    note: "手首と肩が垂直",
    defaultWeight: "10",
    defaultReps: 10,
    defaultSets: 3,
  },
  {
    name: "ダンベルプレス（ナロー）",
    note: "手首と肩が垂直",
    defaultWeight: "10",
    defaultReps: 10,
    defaultSets: 3,
  },
  {
    name: "ダンベルローイング",
    note: "体重を半分ずつ乗せる\nx の軸（胸腰筋膜）を意識\nついている手と片足がしっかりしていないと重心が真ん中に来ない",
    defaultWeight: "10",
    defaultReps: 10,
    defaultSets: 3,
  },
  {
    name: "ダンベルアーム",
    note: "",
    defaultWeight: "8",
    defaultReps: 10,
    defaultSets: 3,
  },
  {
    name: "スミスマシンベンチプレス",
    note: "重めの日は 70kg × 5",
    defaultWeight: "60",
    defaultReps: 10,
    defaultSets: 3,
  },
];

export async function POST() {
  const existing = await prisma.exerciseMenu.findMany({ select: { name: true } });
  const taken = new Set(existing.map((m) => m.name));

  const maxOrder = await prisma.exerciseMenu.aggregate({ _max: { sortOrder: true } });
  let sortOrder = (maxOrder._max.sortOrder ?? -1) + 1;

  const created: string[] = [];
  const skipped: string[] = [];
  for (const menu of MENUS) {
    if (taken.has(menu.name)) {
      skipped.push(menu.name);
      continue;
    }
    await prisma.exerciseMenu.create({
      data: { ...menu, type: "strength", sortOrder: sortOrder++ },
    });
    created.push(menu.name);
  }

  return NextResponse.json({ created, skipped });
}
