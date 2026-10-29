import { getCurrentSession } from "@/lib/auth";
import { db } from "@/db";
import { plans } from "@/db/schema";
import { eq } from "drizzle-orm";
import AddMemberForm from "@/components/add-member-form";

export default async function NewMemberPage() {
  const current = await getCurrentSession();

  // Fetch active plans for selection
  const activePlans = await db
    .select()
    .from(plans)
    .where(eq(plans.isActive, true))
    .orderBy(plans.pricePaise);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="pb-3 border-b border-slate-200">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
          Enroll New Member
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Step-by-step registration, plan selection, pricing preview, and payment recording
        </p>
      </div>

      <AddMemberForm
        plans={activePlans}
        userRole={current?.user.role || "STAFF"}
      />
    </div>
  );
}
