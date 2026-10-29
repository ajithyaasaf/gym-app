import Link from "next/link";
import { getCurrentSession } from "@/lib/auth";
import { getDashboardStats } from "@/server/services/reports-service";
import { formatINR } from "@/lib/money";
import {
  Users,
  CheckCircle2,
  AlertTriangle,
  Clock,
  PhoneCall,
  IndianRupee,
  UserPlus,
  PlusCircle,
  ArrowRight,
  TrendingUp,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default async function DashboardPage() {
  const current = await getCurrentSession();
  const role = current?.user.role || "STAFF";
  const isOwner = role === "OWNER";

  const stats = await getDashboardStats(role);

  return (
    <div className="space-y-6">
      {/* Top Welcome & Quick Reception Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Gym Reception & Operations
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Signed in as <span className="font-semibold text-slate-700">{current?.user.name}</span> ({role})
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link href="/members/new">
            <Button size="sm" className="gap-1.5 shadow-sm">
              <UserPlus className="h-4 w-4" />
              <span>Add Member</span>
            </Button>
          </Link>
          <Link href="/attendance">
            <Button variant="outline" size="sm" className="gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span>Attendance</span>
            </Button>
          </Link>
          <Link href="/enquiries">
            <Button variant="outline" size="sm" className="gap-1.5">
              <PlusCircle className="h-4 w-4 text-indigo-600" />
              <span>New Enquiry</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Owner Financials Section (Restricted from Staff!) */}
      {isOwner && "financials" in stats && stats.financials && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Financial Collections (Owner Confidential)
            </h2>
            <Link
              href="/reports"
              className="text-xs font-medium text-indigo-600 hover:text-indigo-800 inline-flex items-center gap-1"
            >
              <span>Detailed Reports</span>
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border-l-4 border-l-emerald-500">
              <CardContent className="p-4">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-xs font-medium">Today Collections</span>
                  <IndianRupee className="h-4 w-4 text-emerald-600" />
                </div>
                <div className="text-2xl font-bold text-slate-900 mt-2">
                  {formatINR(stats.financials.todayCollectionsPaise)}
                </div>
                <p className="text-[11px] text-slate-500 mt-1">Gross received today (IST)</p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-indigo-500">
              <CardContent className="p-4">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-xs font-medium">This Month Net Collections</span>
                  <TrendingUp className="h-4 w-4 text-indigo-600" />
                </div>
                <div className="text-2xl font-bold text-slate-900 mt-2">
                  {formatINR(stats.financials.monthNetCollectionsPaise)}
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Gross: {formatINR(stats.financials.monthCollectionsPaise)} | Refunds: {formatINR(stats.financials.monthRefundsPaise)}
                </p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-rose-500">
              <CardContent className="p-4">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-xs font-medium">Outstanding Member Dues</span>
                  <AlertTriangle className="h-4 w-4 text-rose-600" />
                </div>
                <div className="text-2xl font-bold text-rose-700 mt-2">
                  {formatINR(stats.financials.totalOutstandingDuesPaise)}
                </div>
                <p className="text-[11px] text-slate-500 mt-1">Total pending balances</p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-slate-500">
              <CardContent className="p-4">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-xs font-medium">Quick Money Link</span>
                  <IndianRupee className="h-4 w-4 text-slate-600" />
                </div>
                <div className="mt-2 flex gap-2">
                  <Link href="/money/payments" className="w-full">
                    <Button variant="outline" size="sm" className="w-full text-xs">
                      Payments Log
                    </Button>
                  </Link>
                  <Link href="/money/expenses" className="w-full">
                    <Button variant="outline" size="sm" className="w-full text-xs">
                      Expenses
                    </Button>
                  </Link>
                </div>
                <p className="text-[11px] text-slate-500 mt-2">Track receipts & cash flow</p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Operational Dashboard Metrics (Accessible to Owner & Staff) */}
      <div className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Gym Operations & Member Status
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link href="/members?status=ACTIVE" className="block group">
            <Card className="hover:border-indigo-300 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-xs font-medium">Active Unique Members</span>
                  <Users className="h-4 w-4 text-indigo-600" />
                </div>
                <div className="text-2xl font-bold text-slate-900 mt-2">
                  {stats.activeMembersCount}
                </div>
                <div className="flex items-center justify-between mt-2 text-[11px] text-slate-500">
                  <span>Currently enrolled</span>
                  <span className="text-indigo-600 font-medium group-hover:underline">View list →</span>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/attendance" className="block group">
            <Card className="hover:border-emerald-300 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-xs font-medium">Today Visits (Check-ins)</span>
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                </div>
                <div className="text-2xl font-bold text-slate-900 mt-2">
                  {stats.todayAttendanceCount}
                </div>
                <div className="flex items-center justify-between mt-2 text-[11px] text-slate-500">
                  <span>Checked in today</span>
                  <span className="text-emerald-600 font-medium group-hover:underline">Open desk →</span>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/follow-ups?tab=RENEWAL_UPCOMING" className="block group">
            <Card className="hover:border-amber-300 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-xs font-medium">Upcoming Expiries (7 Days)</span>
                  <Clock className="h-4 w-4 text-amber-600" />
                </div>
                <div className="text-2xl font-bold text-amber-700 mt-2">
                  {stats.upcomingExpiriesCount}
                </div>
                <div className="flex items-center justify-between mt-2 text-[11px] text-slate-500">
                  <span>Need timely renewal</span>
                  <span className="text-amber-600 font-medium group-hover:underline">Follow up →</span>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/follow-ups" className="block group">
            <Card className="hover:border-rose-300 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-xs font-medium">Overdue / Today Follow-ups</span>
                  <PhoneCall className="h-4 w-4 text-rose-600" />
                </div>
                <div className="text-2xl font-bold text-rose-700 mt-2">
                  {stats.dueFollowUpsCount}
                </div>
                <div className="flex items-center justify-between mt-2 text-[11px] text-slate-500">
                  <span>Callbacks & reminders</span>
                  <span className="text-rose-600 font-medium group-hover:underline">Call now →</span>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>

      {/* Operational Reception Helper Callout */}
      <Card className="bg-gradient-to-r from-indigo-50 to-slate-50 border-indigo-100">
        <CardContent className="p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-indigo-950">
              Reception Daily Priority Checklist
            </h3>
            <p className="text-xs text-indigo-800">
              Check in members on arrival, collect outstanding balances shown in yellow warning badges, and confirm renewals before term expiry.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link href="/attendance">
              <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-xs">
                Launch Check-in
              </Button>
            </Link>
            <Link href="/follow-ups">
              <Button variant="outline" size="sm" className="text-xs bg-white">
                Review Follow-ups
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
