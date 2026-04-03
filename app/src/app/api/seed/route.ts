import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST() {
  // Seed categories
  const existingCategories = await prisma.category.count();
  if (existingCategories === 0) {
    await prisma.category.createMany({
      data: [
        { name: "事業A", sortOrder: 0 },
        { name: "事業B", sortOrder: 1 },
        { name: "全体", sortOrder: 2 },
        { name: "プライベート", sortOrder: 3 },
      ],
    });
  }

  // Seed genres
  const existingGenres = await prisma.genre.count();
  if (existingGenres === 0) {
    await prisma.genre.createMany({
      data: [
        { name: "1on1", color: "#ef4444", sortOrder: 0 },
        { name: "MTG", color: "#f97316", sortOrder: 1 },
        { name: "開発", color: "#3b82f6", sortOrder: 2 },
        { name: "プロジェクト", color: "#8b5cf6", sortOrder: 3 },
        { name: "思考", color: "#06b6d4", sortOrder: 4 },
        { name: "対話", color: "#10b981", sortOrder: 5 },
        { name: "ルーティン", color: "#6b7280", sortOrder: 6 },
      ],
    });
  }

  // Seed expense categories
  const existingExpCats = await prisma.expenseCategory.count();
  if (existingExpCats === 0) {
    await prisma.expenseCategory.createMany({
      data: [
        { name: "コンビニ", color: "#06b6d4", icon: "cart", sortOrder: 0 },
        { name: "食費(昼)", color: "#f97316", icon: "food", sortOrder: 1 },
        { name: "食費(夜)", color: "#3b82f6", icon: "dinner", sortOrder: 2 },
        { name: "趣味", color: "#06b6d4", icon: "hobby", sortOrder: 3 },
        { name: "誰かに", color: "#ef4444", icon: "heart", sortOrder: 4 },
        { name: "カフェ・珈琲器具", color: "#92400e", icon: "coffee", sortOrder: 5 },
        { name: "本", color: "#3b82f6", icon: "book", sortOrder: 6 },
        { name: "交際費(飲会,付添)", color: "#a855f7", icon: "party", sortOrder: 7 },
        { name: "宿泊", color: "#3b82f6", icon: "hotel", sortOrder: 8 },
        { name: "交通費", color: "#6b7280", icon: "train", sortOrder: 9 },
        { name: "日用品", color: "#10b981", icon: "daily", sortOrder: 10 },
        { name: "備品", color: "#6b7280", icon: "device", sortOrder: 11 },
        { name: "衣服・美容", color: "#ec4899", icon: "clothes", sortOrder: 12 },
        { name: "投資・保険", color: "#eab308", icon: "piggy", sortOrder: 13 },
        { name: "家の固定費", color: "#eab308", icon: "house", sortOrder: 14 },
        { name: "PC・携帯", color: "#3b82f6", icon: "wifi", sortOrder: 15 },
        { name: "クレカ", color: "#eab308", icon: "card", sortOrder: 16 },
        { name: "サブスク", color: "#8b5cf6", icon: "subscribe", sortOrder: 17 },
      ],
    });
  }

  // Seed fixed expenses
  const existingFixed = await prisma.fixedExpense.count();
  if (existingFixed === 0) {
    // Look up expense category IDs
    const expCats = await prisma.expenseCategory.findMany();
    const catMap = new Map(expCats.map((c) => [c.name, c.id]));

    const fixedData = [
      { title: "NISA", amount: 40000, categoryId: catMap.get("投資・保険"), day: 1, sortOrder: 0 },
      { title: "養老保険", amount: 25420, categoryId: catMap.get("投資・保険"), day: 1, sortOrder: 1 },
      { title: "掛け捨て", amount: 5180, categoryId: catMap.get("投資・保険"), day: 1, sortOrder: 2 },
      { title: "就業不能", amount: 6432, categoryId: catMap.get("投資・保険"), day: 1, sortOrder: 3 },
      { title: "家・WiFi・電水熱", amount: 100000, categoryId: catMap.get("家の固定費"), day: 1, sortOrder: 4 },
      { title: "ANAゴールド(15,400/年)", amount: 1300, categoryId: catMap.get("クレカ"), day: 1, sortOrder: 5 },
      { title: "楽天+日本通信", amount: 4000, categoryId: catMap.get("PC・携帯"), day: 1, sortOrder: 6 },
      { title: "YouTube (12,800/年)", amount: 1065, categoryId: catMap.get("サブスク"), day: 1, sortOrder: 7 },
      { title: "icloud", amount: 400, categoryId: catMap.get("サブスク"), day: 1, sortOrder: 8 },
      { title: "Amazon Prime(5,900/年)", amount: 500, categoryId: catMap.get("サブスク"), day: 1, sortOrder: 9 },
      { title: "office365 family(7,000/年)", amount: 580, categoryId: catMap.get("サブスク"), day: 1, sortOrder: 10 },
      { title: "Money forward(5,300/年)", amount: 440, categoryId: catMap.get("サブスク"), day: 1, sortOrder: 11 },
      { title: "claude(22,500/年)", amount: 1900, categoryId: catMap.get("サブスク"), day: 1, sortOrder: 12 },
      { title: "iPhone16pro", amount: 7168, categoryId: catMap.get("PC・携帯"), day: 1, sortOrder: 13 },
      { title: "kindle unlimited", amount: 980, categoryId: catMap.get("サブスク"), day: 1, sortOrder: 14 },
    ];

    await prisma.fixedExpense.createMany({
      data: fixedData.map((d) => ({
        title: d.title,
        amount: d.amount,
        type: "expense",
        categoryId: d.categoryId || null,
        day: d.day,
        sortOrder: d.sortOrder,
      })),
    });
  }

  return NextResponse.json({ message: "Seeded successfully" }, { status: 201 });
}
