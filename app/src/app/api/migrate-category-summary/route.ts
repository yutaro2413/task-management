import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST() {
  // Add excludeFromSummary column if not exists (Prisma handles via db push)
  // Set excludeFromSummary=true for プライベート and transit
  const result = await prisma.category.updateMany({
    where: { name: { in: ["プライベート", "transit"] } },
    data: { excludeFromSummary: true },
  });

  return NextResponse.json({
    message: `Updated ${result.count} categories to excludeFromSummary=true`,
  });
}
