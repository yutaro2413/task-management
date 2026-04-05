import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST() {
  // Add 移動 genre with type ロス if it doesn't exist
  const existing = await prisma.genre.findFirst({ where: { name: "移動" } });
  if (existing) {
    return NextResponse.json({ message: "移動 genre already exists", id: existing.id });
  }

  const maxOrder = await prisma.genre.aggregate({ _max: { sortOrder: true } });
  const nextOrder = (maxOrder._max.sortOrder ?? -1) + 1;

  const genre = await prisma.genre.create({
    data: { name: "移動", color: "#f59e0b", type: "ロス", sortOrder: nextOrder },
  });

  return NextResponse.json({ message: "Created 移動 genre", id: genre.id }, { status: 201 });
}
