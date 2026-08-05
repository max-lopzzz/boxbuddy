import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUserId } from "../../lib/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const userId = await getCurrentUserId();
  if (!userId) {
    redirect("/login");
  }
  return (
    <>
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-orange-100 bg-white px-4 py-3">
        <Link href="/" className="font-semibold text-stone-800">
          BoxBuddy
        </Link>
        <Link href="/settings" className="text-sm text-stone-500 underline">
          Settings
        </Link>
      </header>
      {children}
    </>
  );
}
