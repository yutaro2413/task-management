// 今日の一言テンプレート
// content 文字列を ★見出し ベースでセクションに分解／直列化するヘルパー。
// DB は単一の content フィールドのままで、フォーマットで構造化を表現する。

export type NoteSectionKey =
  | "quote"
  | "reflection"
  | "achievement"
  | "self"
  | "others";

export const NOTE_SECTIONS: { key: NoteSectionKey; label: string; placeholder: string }[] = [
  { key: "quote", label: "心に残った言葉・会話・本", placeholder: "印象に残った発言・一節など" },
  { key: "reflection", label: "反省・イヤだったこと・改善点", placeholder: "次に活かしたいこと" },
  { key: "achievement", label: "できたこと・良かったこと・達成できたこと", placeholder: "小さな達成もOK" },
  { key: "self", label: "自分の褒めポイント・成長ポイント", placeholder: "自分を認めるひとこと" },
  { key: "others", label: "他人の褒めポイント・ありがとうポイント", placeholder: "感謝したい人・リスペクトした人" },
];

export type NoteSections = Partial<Record<NoteSectionKey, string>> & { _free?: string };

const HEADER_RE = /^★(.+?)\s*$/;

/**
 * content 文字列を ★見出し ごとに分解する。
 * 既知の見出しに該当しない行（あるいは最初の見出しの前の行）は `_free` に入れる。
 * 構造化テンプレが使われていない旧形式のノートも表示できるようにする。
 */
export function parseNote(content: string): NoteSections {
  if (!content) return {};
  const labelToKey = new Map(NOTE_SECTIONS.map((s) => [s.label, s.key]));
  const result: NoteSections = {};
  const lines = content.split("\n");
  let currentKey: NoteSectionKey | "_free" | null = null;
  let buffer: string[] = [];

  const flush = () => {
    if (currentKey == null) {
      const pre = buffer.join("\n").trim();
      if (pre) result._free = pre;
    } else if (currentKey === "_free") {
      const text = buffer.join("\n").trim();
      if (text) result._free = (result._free ? result._free + "\n" : "") + text;
    } else {
      const text = buffer.join("\n").trim();
      if (text) result[currentKey] = text;
    }
    buffer = [];
  };

  for (const line of lines) {
    const m = line.match(HEADER_RE);
    if (m) {
      const key = labelToKey.get(m[1].trim());
      if (key) {
        flush();
        currentKey = key;
        continue;
      }
    }
    buffer.push(line);
  }
  flush();
  return result;
}

/**
 * セクション Map を content 文字列に直列化する。
 * 空のセクションは出力に含めない（見出しだけの行を避ける）。
 */
export function serializeNote(sections: NoteSections): string {
  const parts: string[] = [];
  for (const s of NOTE_SECTIONS) {
    const v = sections[s.key]?.trim();
    if (v) parts.push(`★${s.label}\n${v}`);
  }
  const free = sections._free?.trim();
  if (free) parts.push(free);
  return parts.join("\n\n");
}

/** テンプレ形式かどうか（見出しが一つでもあれば true） */
export function hasTemplate(content: string): boolean {
  if (!content) return false;
  return NOTE_SECTIONS.some((s) => content.includes(`★${s.label}`));
}
