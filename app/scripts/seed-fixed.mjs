// One-time seed script for fixed expenses
// Run with: node scripts/seed-fixed.mjs
import pg from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.log("DATABASE_URL not set, skipping fixed expense seed.");
  process.exit(0);
}

const pool = new pg.Pool({ connectionString });

async function main() {
  const client = await pool.connect();
  try {
    // Check if fixed expenses already exist
    const existing = await client.query("SELECT count(*) FROM \"FixedExpense\"");
    if (parseInt(existing.rows[0].count) > 0) {
      console.log(`Fixed expenses already exist (${existing.rows[0].count} items), skipping seed.`);
      return;
    }

    // Ensure "サブスク" category exists
    let subsCatRow = await client.query("SELECT id FROM \"ExpenseCategory\" WHERE name = $1", ["サブスク"]);
    if (subsCatRow.rows.length === 0) {
      const maxOrderRes = await client.query("SELECT COALESCE(MAX(\"sortOrder\"), 0) as max FROM \"ExpenseCategory\"");
      const nextOrder = maxOrderRes.rows[0].max + 1;
      const id = crypto.randomUUID().replace(/-/g, "").slice(0, 25);
      await client.query(
        "INSERT INTO \"ExpenseCategory\" (id, name, color, icon, \"sortOrder\", \"createdAt\", \"updatedAt\") VALUES ($1, $2, $3, $4, $5, NOW(), NOW())",
        [id, "サブスク", "#8b5cf6", "subscribe", nextOrder]
      );
      subsCatRow = { rows: [{ id }] };
    }

    // Get all expense categories
    const allCats = await client.query("SELECT id, name FROM \"ExpenseCategory\"");
    const catMap = new Map(allCats.rows.map((c) => [c.name, c.id]));

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

    for (let i = 0; i < fixedData.length; i++) {
      const d = fixedData[i];
      const id = crypto.randomUUID().replace(/-/g, "").slice(0, 25);
      await client.query(
        `INSERT INTO "FixedExpense" (id, title, amount, type, "categoryId", day, active, "sortOrder", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())`,
        [id, d.title, d.amount, "expense", catMap.get(d.cat) || null, 1, true, i]
      );
    }

    const total = fixedData.reduce((s, d) => s + d.amount, 0);
    console.log(`固定費${fixedData.length}件を登録しました（月額合計: ${total.toLocaleString()}円）`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error("Seed error:", e.message);
  process.exit(1);
});
