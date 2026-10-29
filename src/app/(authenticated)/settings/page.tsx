import { getCurrentSession } from "@/lib/auth";
import SettingsHubView from "@/components/settings-hub-view";

export default async function SettingsPage() {
  const current = await getCurrentSession();

  return (
    <div className="space-y-6">
      <div className="pb-3 border-b border-slate-200">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
          Gym Settings & Staff Administration
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Configure gym profile, manage membership catalogue, administer staff credentials, and view system audit history
        </p>
      </div>

      <SettingsHubView userRole={current?.user.role || "STAFF"} />
    </div>
  );
}

