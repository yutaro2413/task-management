import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST() {
  // Ensure "サブスク" category exists
  let subsCat = await prisma.expenseCategory.findFirst({ where: { name: "サブスク" } });
  if (!subsCat) {
    const maxOrder = await prisma.expenseCategory.aggregate({ _max: { sortOrder: true } });
    subsCat = await prisma.expenseCategory.create({
      data: { name: "サブスク", color: "#8b5cf6", icon: "subscribe", sortOrder: (maxOrder._max.sortOrder ?? 0) + 1 },
    });
  }

  // Look up category IDs
  const allCats = await prisma.expenseCategory.findMany();
  const catMap = new Map(allCats.map((c) => [c.name, c.id]));

  // Clear existing fixed expenses and re-create
  await prisma.fixedExpense.deleteMany({});

  const fixedData = [
    { title: "NISA", amount: 40000, cat: "投資・保険" },
    { title: "養老保険", amount: 25420, cat: "投資・保険" },
    { title: "掛け捨て", amount: 5180, cat: "投資・保険" },
    { title: "就業不能", amount: 6432, cat: "投資・保険" },
    { title: "家・WiFi・電水熱", amount: 100000, cat: "家の固定費" },
    { title: "ANAゴールド(15,400/年)", amount: 1300, cat: "クレカ" },
    { title: "楽天+日本通信", amount: 4000, cat: "PC・携帯" },
    { title: "YouTube (12,800/年)", amount: 1065, cat: "サブスク" },
    { title: "icloud", amount: 400, cat: "サブスク" },
    { title: "Amazon Prime(5,900/年)", amount: 500, cat: "サブスク" },
    { title: "office365 family(7,000/年)", amount: 580, cat: "サブスク" },
    { title: "Money forward(5,300/年)", amount: 440, cat: "サブスク" },
    { title: "claude(22,500/年)", amount: 1900, cat: "サブスク" },
    { title: "iPhone16pro", amount: 7168, cat: "PC・携帯" },
    { title: "kindle unlimited", amount: 980, cat: "サブスク" },
  ];

  await prisma.fixedExpense.createMany({
    data: fixedData.map((d, i) => ({
      title: d.title,
      amount: d.amount,
      type: "expense",
      categoryId: catMap.get(d.cat) || null,
      day: 1,
      sortOrder: i,
    })),
  });

  const total = fixedData.reduce((s, d) => s + d.amount, 0);
  return NextResponse.json({
    message: `固定費${fixedData.length}件を登録しました（月額合計: ${total.toLocaleString()}円）`,
    count: fixedData.length,
    total,
  }, { status: 201 });
}
