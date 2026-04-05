import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST() {
  try {
    // Step 0: Add 'type' column if not exists
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "Genre" ADD COLUMN IF NOT EXISTS "type" TEXT NOT NULL DEFAULT '経費'`
    );

    // Step 1: Get all existing genres
    const genres = await prisma.genre.findMany();
    const byName = new Map(genres.map((g) => [g.name, g]));

    const kaihatsu = byName.get("開発");
    const mtg = byName.get("MTG");
    const project = byName.get("プロジェクト");
    const shikou = byName.get("思考");
    const taiwa = byName.get("対話");
    const oneOnOne = byName.get("1on1");
    const routine = byName.get("ルーティン");

    const results: string[] = [];

    // Step 2: Rename 開発 → PJ/LvUp, set type=投資
    if (kaihatsu) {
      await prisma.genre.update({
        where: { id: kaihatsu.id },
        data: { name: "PJ/LvUp", type: "投資", color: "#3b82f6", sortOrder: 0 },
      });
      results.push("開発 → PJ/LvUp (投資)");

      // Step 3: Reassign MTG and プロジェクト entries to PJ/LvUp
      if (mtg) {
        const count = await prisma.timeEntry.updateMany({
          where: { genreId: mtg.id },
          data: { genreId: kaihatsu.id },
        });
        await prisma.genre.delete({ where: { id: mtg.id } });
        results.push(`MTG → PJ/LvUp: ${count.count} entries reassigned, genre deleted`);
      }
      if (project) {
        const count = await prisma.timeEntry.updateMany({
          where: { genreId: project.id },
          data: { genreId: kaihatsu.id },
        });
        await prisma.genre.delete({ where: { id: project.id } });
        results.push(`プロジェクト → PJ/LvUp: ${count.count} entries reassigned, genre deleted`);
      }
    }

    // Step 4: Rename remaining genres
    if (shikou) {
      await prisma.genre.update({
        where: { id: shikou.id },
        data: { name: "思考・学習", type: "投資", color: "#06b6d4", sortOrder: 1 },
      });
      results.push("思考 → 思考・学習 (投資)");
    }
    if (taiwa) {
      await prisma.genre.update({
        where: { id: taiwa.id },
        data: { name: "指導/対話", type: "投資", color: "#10b981", sortOrder: 5 },
      });
      results.push("対話 → 指導/対話 (投資)");
    }
    if (oneOnOne) {
      await prisma.genre.update({
        where: { id: oneOnOne.id },
        data: { name: "1on1", type: "投資", color: "#ef4444", sortOrder: 6 },
      });
      results.push("1on1 → 1on1 (投資)");
    }
    if (routine) {
      await prisma.genre.update({
        where: { id: routine.id },
        data: { name: "ルーティン", type: "経費", color: "#6b7280", sortOrder: 7 },
      });
      results.push("ルーティン → ルーティン (経費)");
    }

    // Step 5: Create new genres
    const newGenres = [
      { name: "顧客(対応)", color: "#f97316", type: "経費", sortOrder: 2 },
      { name: "メンテ(自発)", color: "#8b5cf6", type: "経費", sortOrder: 3 },
      { name: "メンテ(対応)", color: "#a855f7", type: "経費", sortOrder: 4 },
      { name: "その他(経)", color: "#9ca3af", type: "経費", sortOrder: 8 },
      { name: "その他(投)", color: "#eab308", type: "投資", sortOrder: 9 },
    ];

    for (const ng of newGenres) {
      const existing = await prisma.genre.findFirst({ where: { name: ng.name } });
      if (!existing) {
        await prisma.genre.create({ data: ng });
        results.push(`Created: ${ng.name} (${ng.type})`);
      } else {
        results.push(`Skipped (exists): ${ng.name}`);
      }
    }

    // Final state
    const finalGenres = await prisma.genre.findMany({ orderBy: { sortOrder: "asc" } });

    return NextResponse.json({ success: true, results, finalGenres });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
