import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth";
import { db } from "@/db";
import { gymSettings } from "@/db/schema";
import { eq } from "drizzle-orm";
import NavHeader from "@/components/nav-header";

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const current = await getCurrentSession();

  if (!current) {
    redirect("/login");
  }

  // Fetch gym name & details
  const settingsRows = await db
    .select()
    .from(gymSettings)
    .where(eq(gymSettings.id, "default"))
    .limit(1);

  const gym = settingsRows[0] || {
    gymName: "IronPulse Fitness Club",
    phone: "+91 98765 43210",
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <NavHeader user={current.user} gymName={gym.gymName} />
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {children}
      </main>
      <footer className="no-print border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>{gym.gymName} • Operations & Reception System</span>
          <span>Asia/Kolkata (IST) • Single Gym Workspace</span>
        </div>
      </footer>
    </div>
  );
}
