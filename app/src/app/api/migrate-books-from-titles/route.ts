import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// 旧 BookTitle を Book(source="paper") として複製し、各 ReadingLog の bookId を埋める。
// 同名の Book が既にあれば再利用する。冪等。
export async function POST() {
  const titles = await prisma.bookTitle.findMany({ include: { readingLogs: true } });

  let booksCreated = 0;
  let logsLinked = 0;

  for (const t of titles) {
    let book = await prisma.book.findFirst({ where: { title: t.title, asin: null } });
    if (!book) {
      book = await prisma.book.create({
        data: { title: t.title, source: "paper" },
      });
      booksCreated++;
    }
    for (const log of t.readingLogs) {
      if (log.bookId) continue;
      await prisma.readingLog.update({
        where: { id: log.id },
        data: { bookId: book.id },
      });
      logsLinked++;
    }
  }

  return NextResponse.json({
    message: `Migrated ${titles.length} BookTitle(s): created ${booksCreated} Book row(s), linked ${logsLinked} ReadingLog(s).`,
  });
}
