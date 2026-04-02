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
        { name: "投資・保険", color: "#eab308", icon: "invest", sortOrder: 13 },
        { name: "家の固定費", color: "#eab308", icon: "house", sortOrder: 14 },
        { name: "PC・携帯", color: "#3b82f6", icon: "pc", sortOrder: 15 },
        { name: "クレカ", color: "#eab308", icon: "card", sortOrder: 16 },
      ],
    });
  }

  return NextResponse.json({ message: "Seeded successfully" }, { status: 201 });
}
