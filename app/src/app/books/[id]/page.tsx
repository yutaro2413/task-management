import BottomNav from "@/components/BottomNav";
import BookDetail from "@/components/BookDetail";

export default async function BookDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <main className="h-screen flex flex-col pb-20 lg:pb-0">
      <BookDetail bookId={id} />
      <BottomNav />
    </main>
  );
}
