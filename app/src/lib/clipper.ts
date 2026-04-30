// Web Clipper 関連の純粋関数。クライアント／サーバー両方から使う。
//
// normalizeUrl:  同じ記事を複数の URL で保存するのを避けるため、tracking パラメータ等を除去
// makeSelectionExternalId: 選択範囲テキストから決定論的な externalId を作る (重複排除キー)

const TRACKING_PARAM_PREFIXES = ["utm_", "fbclid", "gclid", "mc_eid", "mc_cid", "_hsenc", "_hsmi", "ref_", "share_"];
const TRACKING_PARAM_EXACT = new Set(["fbclid", "gclid", "ref", "share", "spm"]);

export function normalizeUrl(input: string): string {
  let u: URL;
  try {
    u = new URL(input);
  } catch {
    // パース不能ならそのまま返す
    return input.trim();
  }
  // hash は捨てる (記事内アンカーは別ハイライトとしては扱わない)
  u.hash = "";

  // tracking params 除去
  const drop: string[] = [];
  u.searchParams.forEach((_, key) => {
    const k = key.toLowerCase();
    if (TRACKING_PARAM_EXACT.has(k)) drop.push(key);
    else if (TRACKING_PARAM_PREFIXES.some((p) => k.startsWith(p))) drop.push(key);
  });
  for (const k of drop) u.searchParams.delete(k);

  // 末尾スラッシュは正規化しない (Wordpress 等は付き / 付かないで別記事のことがある)
  return u.toString();
}

// 選択範囲テキストの最初の N 文字 + 長さで簡易ハッシュ。
// 長文を全文ハッシュすると微妙な空白差で別物になりがちなので、頭400文字を正規化して使う。
export function makeSelectionExternalId(text: string): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  const head = normalized.slice(0, 400);
  // 32-bit FNV-1a (依存追加しないため手書き、衝突は実用上ほぼ起きない)
  let h = 0x811c9dc5;
  for (let i = 0; i < head.length; i++) {
    h ^= head.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `sel-${normalized.length}-${h.toString(16).padStart(8, "0")}`;
}
