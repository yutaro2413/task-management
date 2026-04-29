import BottomNav from "@/components/BottomNav";
import BooksPage from "@/components/BooksPage";

export default function Books() {
  return (
    <main className="h-screen flex flex-col pb-20 lg:pb-0">
      <BooksPage />
      <BottomNav />
    </main>
  );
}
