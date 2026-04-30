// 機能フラグ。「いまは使わないが将来戻したい」機能をここで切り替える。
//
// 復活手順は docs/disabled-features.md を参照。
// API ルート・DB スキーマ・コンポーネントは残してあるので、true に戻すだけで再有効化される。

export const features = {
  webClipper: false,  // /settings の Web Clipper UI と /books の Web フィルタ
  pdfImport: false,   // /books の PDF 取込ボタンと PDF フィルタ
  anime: true,
} as const;
