import { getCurrentSession } from "@/lib/auth";
import FollowUpsView from "@/components/followups-view";

export default async function FollowUpsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const current = await getCurrentSession();
  const params = await searchParams;

  return (
    <div className="space-y-6">
      <div className="pb-3 border-b border-slate-200">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
          Daily Follow-ups & Retention
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Actionable call lists for upcoming renewals, fee dues, absent members, and enquiry callbacks
        </p>
      </div>

      <FollowUpsView
        initialTab={params.tab || "DUE_TODAY"}
        userRole={current?.user.role || "STAFF"}
      />
    </div>
  );
}

