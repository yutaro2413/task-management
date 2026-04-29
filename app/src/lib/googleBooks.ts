// Google Books API の薄いラッパー。キーレスで日 1,000 リクエストまで無料。
// 失敗してもスローせず null を返し、呼び出し側はメタ未取得でも続行できるようにする。

export type BookMetadata = {
  title?: string;
  author?: string;
  coverUrl?: string;
  publisher?: string;
  isbn?: string;
};

type VolumeInfo = {
  title?: string;
  authors?: string[];
  publisher?: string;
  imageLinks?: { thumbnail?: string; smallThumbnail?: string };
  industryIdentifiers?: { type: string; identifier: string }[];
};

type VolumesResponse = {
  items?: { volumeInfo: VolumeInfo }[];
};

function normalizeImageUrl(url?: string): string | undefined {
  if (!url) return undefined;
  // Google Books は http で返すことがある。https に揃え、zoom を上げる。
  return url.replace(/^http:\/\//, "https://").replace(/&edge=curl/, "").replace(/&zoom=\d+/, "&zoom=2");
}

function pickFirst(info: VolumeInfo): BookMetadata {
  const isbn = info.industryIdentifiers?.find((i) => i.type === "ISBN_13")?.identifier
    ?? info.industryIdentifiers?.find((i) => i.type === "ISBN_10")?.identifier;
  return {
    title: info.title,
    author: info.authors?.join(", "),
    coverUrl: normalizeImageUrl(info.imageLinks?.thumbnail || info.imageLinks?.smallThumbnail),
    publisher: info.publisher,
    isbn,
  };
}

async function queryVolumes(q: string): Promise<BookMetadata | null> {
  try {
    const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=1`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as VolumesResponse;
    const first = data.items?.[0]?.volumeInfo;
    if (!first) return null;
    return pickFirst(first);
  } catch {
    return null;
  }
}

export async function searchBookMetadata(input: {
  isbn?: string;
  asin?: string;
  title?: string;
  author?: string;
}): Promise<BookMetadata | null> {
  if (input.isbn) {
    const byIsbn = await queryVolumes(`isbn:${input.isbn}`);
    if (byIsbn) return byIsbn;
  }
  if (input.title) {
    const titleQ = `intitle:${input.title}` + (input.author ? ` inauthor:${input.author}` : "");
    const byTitle = await queryVolumes(titleQ);
    if (byTitle) return byTitle;
  }
  // ASIN は Google Books では引けないのでタイトルで再試行（呼び出し側がフォールバックする想定）。
  return null;
}
