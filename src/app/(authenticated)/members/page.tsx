import Link from "next/link";
import { getCurrentSession } from "@/lib/auth";
import { formatINR } from "@/lib/money";
import { formatDisplayDate } from "@/lib/dates";
import {
  Users,
  UserPlus,
  Search,
  Phone,
  Calendar,
  AlertTriangle,
  ChevronRight,
  Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import MembersClientList from "@/components/members-client-list";

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; status?: string; page?: string }>;
}) {
  const current = await getCurrentSession();
  const params = await searchParams;

  return (
    <div className="space-y-5">
      {/* Page Title & Add Member CTA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Gym Members
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Directory of active, paused, expired, and archived member records
          </p>
        </div>

        <Link href="/members/new">
          <Button className="gap-2 shadow-sm w-full sm:w-auto">
            <UserPlus className="h-4 w-4" />
            <span>Add New Member</span>
          </Button>
        </Link>
      </div>

      {/* Client List with Real-time Search, Filters, and Pagination */}
      <MembersClientList
        initialSearch={params.search || ""}
        initialStatus={params.status || ""}
        userRole={current?.user.role || "STAFF"}
      />
    </div>
  );
}

