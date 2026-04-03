import BottomNav from "@/components/BottomNav";
import SettingsPage from "@/components/SettingsPage";

export default function Settings() {
  return (
    <main className="h-screen flex flex-col pb-20 lg:pb-0">
      <SettingsPage />
      <BottomNav />
    </main>
  );
}
