import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const [invResult, costResult] = await Promise.all([
    prisma.genre.updateMany({
      where: { type: "投資", subType: "" },
      data: { subType: "投資的" },
    }),
    prisma.genre.updateMany({
      where: { type: "経費", subType: "" },
      data: { subType: "経費的" },
    }),
  ]);

  return NextResponse.json({
    message: `Backfilled subType: 投資→投資的 (${invResult.count}), 経費→経費的 (${costResult.count})`,
  });
}
