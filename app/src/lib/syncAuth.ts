// 同期エンドポイント (Kindle / Web Clipper / PDF) で共通利用するシェアードシークレット認証。
//
// 環境変数:
//   SYNC_TOKEN          推奨。複数の同期方式で共有するトークン。
//   KINDLE_SYNC_TOKEN   Phase 0 互換。SYNC_TOKEN が未設定なら fallback として参照。
//
// 取得は process.env を都度読む (Vercel 環境変数の差し替えが反映されるよう)。

export function getExpectedToken(): string | null {
  return process.env.SYNC_TOKEN || process.env.KINDLE_SYNC_TOKEN || null;
}

export function checkSyncToken(request: Request): { ok: true } | { ok: false; status: 401 | 500; body: { error: string } } {
  const expected = getExpectedToken();
  if (!expected) {
    return {
      ok: false,
      status: 500,
      body: { error: "SYNC_TOKEN (or KINDLE_SYNC_TOKEN) is not configured on the server" },
    };
  }
  // 複数のヘッダ名を許容 (旧 Kindle クライアントと新 Clipper の両方を受ける)
  const provided =
    request.headers.get("x-sync-token") ||
    request.headers.get("x-kindle-sync-token");
  if (provided !== expected) {
    return { ok: false, status: 401, body: { error: "unauthorized" } };
  }
  return { ok: true };
}

export const syncCorsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Sync-Token, X-Kindle-Sync-Token",
};
