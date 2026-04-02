import BottomNav from "@/components/BottomNav";
import SettingsPage from "@/components/SettingsPage";

export default function Settings() {
  return (
    <main className="flex flex-col min-h-screen pb-20">
      <SettingsPage />
      <BottomNav />
    </main>
  );
}
