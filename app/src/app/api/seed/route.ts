import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const existingCategories = await prisma.category.count();
  if (existingCategories > 0) {
    return NextResponse.json({ message: "Already seeded" });
  }

  await prisma.category.createMany({
    data: [
      { name: "事業A", sortOrder: 0 },
      { name: "事業B", sortOrder: 1 },
      { name: "全体", sortOrder: 2 },
      { name: "プライベート", sortOrder: 3 },
    ],
  });

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

  return NextResponse.json({ message: "Seeded successfully" }, { status: 201 });
}
