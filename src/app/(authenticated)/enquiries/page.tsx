import { getCurrentSession } from "@/lib/auth";
import { db } from "@/db";
import { plans } from "@/db/schema";
import { eq } from "drizzle-orm";
import EnquiriesView from "@/components/enquiries-view";

export default async function EnquiriesPage() {
  const current = await getCurrentSession();

  const activePlans = await db
    .select()
    .from(plans)
    .where(eq(plans.isActive, true))
    .orderBy(plans.pricePaise);

  return (
    <div className="space-y-6">
      <div className="pb-3 border-b border-slate-200">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
          Front Desk Enquiries
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Prospect capture, trial session bookings, and seamless conversion to member accounts
        </p>
      </div>

      <EnquiriesView
        userRole={current?.user.role || "STAFF"}
        plans={activePlans}
      />
    </div>
  );
}

