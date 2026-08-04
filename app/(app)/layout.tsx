import { redirect } from "next/navigation";
import { hasValidSession } from "../../lib/auth";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  if (!hasValidSession()) {
    redirect("/login");
  }
  return <>{children}</>;
}
