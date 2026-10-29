import { notFound, redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth";
import { db } from "@/db";
import { members, plans } from "@/db/schema";
import { eq } from "drizzle-orm";
import MemberProfileView from "@/components/member-profile-view";

export default async function MemberDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const current = await getCurrentSession();
  if (!current) {
    redirect("/login");
  }

  const { id } = await params;

  // Check member exists
  const memberRows = await db
    .select()
    .from(members)
    .where(eq(members.id, id))
    .limit(1);

  if (memberRows.length === 0) {
    notFound();
  }

  // Fetch active plans for renewal
  const activePlans = await db
    .select()
    .from(plans)
    .where(eq(plans.isActive, true))
    .orderBy(plans.pricePaise);

  return (
    <div className="space-y-6">
      <MemberProfileView
        memberId={id}
        userRole={current.user.role}
        plans={activePlans}
      />
    </div>
  );
}

