import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const genres = await prisma.genre.findMany({ orderBy: { sortOrder: "asc" } });
  const counts: Record<string, number> = {};
  for (const g of genres) {
    counts[g.id] = await prisma.timeEntry.count({ where: { genreId: g.id } });
  }
  return NextResponse.json({ genres: genres.map((g) => ({ ...g, entryCount: counts[g.id] || 0 })) });
}

export async function POST() {
  try {
    // Ensure 'type' column exists
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "Genre" ADD COLUMN IF NOT EXISTS "type" TEXT NOT NULL DEFAULT '経費'`
    );

    const results: string[] = [];

    // Current genre IDs (from DB inspection)
    const ID_PJ = "cmnhmr7ce000704kw19mcmokx";           // PJ (was プロジェクト)
    const ID_SHIKOU = "cmnhmr7ce000804kwhu6ul8m0";        // 思考・勉強 (was 思考)
    const ID_KOKYAKU = "cmnhp96oy000h04l9sn1zdq7t";      // 顧客 (user-added)
    const ID_MENTE = "cmnhmr7ce000604kw024qj07m";         // メンテ (was 開発)
    const ID_MTG = "cmnhmr7ce000504kwsiivdass";            // MTG (original)
    const ID_SHIDOU_TAIWA = "cmnhmr7ce000904kwmqhdhrw0";  // 指導/対話 (was 対話)
    const ID_SHIDOU = "cmnhrxtpa000004l4jphr0aae";         // 指導 (user-added)
    const ID_1ON1 = "cmnhmr7ce000404kw6yziko59";           // 1on1 (original)
    const ID_ROUTINE = "cmnhmr7ce000a04kwiv7824l0";        // ルーティン (original)
    const ID_YO_TAIOU = "cmnht2etq000004l11etvyell";      // よー対応 (user-added)
    const ID_KEI_SONOTA = "cmnhpfpe7000004jmob4jgcyv";    // 経:その他 (user-added)
    const ID_TOU_SONOTA = "cmnl3oy45000004l4as4lb90r";    // 投:その他 (user-added)

    // New duplicates from first migration run (no entries):
    const ID_NEW_KOKYAKU = "cmnlgwypi000004l868yr6z5t";
    const ID_NEW_MENTE_J = "cmnlgwz1k000104l8zepy6bqx";
    const ID_NEW_MENTE_T = "cmnlgwzdi000204l8v7ch8t00";
    const ID_NEW_SONOTA_K = "cmnlgwzpf000304l8s5soe15p";
    const ID_NEW_SONOTA_T = "cmnlgx01c000404l80rouh9f1";

    // Step 1: Merge entries from extra genres into target genres
    const merges = [
      { from: ID_MTG, to: ID_PJ, label: "MTG → PJ/LvUp" },
      { from: ID_SHIDOU, to: ID_SHIDOU_TAIWA, label: "指導 → 指導/対話" },
      { from: ID_YO_TAIOU, to: ID_KEI_SONOTA, label: "よー対応 → その他(経)" },
    ];

    for (const m of merges) {
      const count = await prisma.timeEntry.updateMany({
        where: { genreId: m.from },
        data: { genreId: m.to },
      });
      results.push(`${m.label}: ${count.count} entries moved`);
    }

    // Step 2: Delete duplicate/merged genres
    const toDelete = [
      ID_MTG, ID_SHIDOU, ID_YO_TAIOU,
      ID_NEW_KOKYAKU, ID_NEW_MENTE_J, ID_NEW_MENTE_T, ID_NEW_SONOTA_K, ID_NEW_SONOTA_T,
    ];

    for (const id of toDelete) {
      try {
        await prisma.genre.delete({ where: { id } });
        results.push(`Deleted genre: ${id}`);
      } catch {
        results.push(`Skip delete (not found): ${id}`);
      }
    }

    // Step 3: Rename and set types on the 10 target genres
    const updates = [
      { id: ID_PJ, name: "PJ/LvUp", color: "#3b82f6", type: "投資", sortOrder: 0 },
      { id: ID_SHIKOU, name: "思考・学習", color: "#06b6d4", type: "投資", sortOrder: 1 },
      { id: ID_KOKYAKU, name: "顧客(対応)", color: "#f97316", type: "経費", sortOrder: 2 },
      { id: ID_MENTE, name: "メンテ(自発)", color: "#8b5cf6", type: "経費", sortOrder: 3 },
      { id: ID_SHIDOU_TAIWA, name: "指導/対話", color: "#10b981", type: "投資", sortOrder: 5 },
      { id: ID_1ON1, name: "1on1", color: "#ef4444", type: "投資", sortOrder: 6 },
      { id: ID_ROUTINE, name: "ルーティン", color: "#6b7280", type: "経費", sortOrder: 7 },
      { id: ID_KEI_SONOTA, name: "その他(経)", color: "#9ca3af", type: "経費", sortOrder: 8 },
      { id: ID_TOU_SONOTA, name: "その他(投)", color: "#eab308", type: "投資", sortOrder: 9 },
    ];

    for (const u of updates) {
      await prisma.genre.update({
        where: { id: u.id },
        data: { name: u.name, color: u.color, type: u.type, sortOrder: u.sortOrder },
      });
      results.push(`Updated: ${u.name} (${u.type})`);
    }

    // Step 4: Create メンテ(対応) if not exists
    const menteExists = await prisma.genre.findFirst({ where: { name: "メンテ(対応)" } });
    if (!menteExists) {
      await prisma.genre.create({
        data: { name: "メンテ(対応)", color: "#a855f7", type: "経費", sortOrder: 4 },
      });
      results.push("Created: メンテ(対応) (経費)");
    } else {
      await prisma.genre.update({
        where: { id: menteExists.id },
        data: { sortOrder: 4, type: "経費" },
      });
      results.push("メンテ(対応) already exists, updated sortOrder");
    }

    const finalGenres = await prisma.genre.findMany({ orderBy: { sortOrder: "asc" } });

    return NextResponse.json({ success: true, results, finalGenres });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
