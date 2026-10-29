import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth";
import { USER_ROLES } from "@/lib/constants";
import ExpensesLedgerView from "@/components/expenses-ledger-view";

export default async function ExpensesPage() {
  const current = await getCurrentSession();
  if (!current) {
    redirect("/login");
  }

  // Owner guard
  if (current.user.role !== USER_ROLES.OWNER) {
    return (
      <div className="max-w-md mx-auto my-12 p-6 bg-white rounded-xl border border-rose-200 shadow-sm text-center space-y-3">
        <h2 className="text-base font-bold text-rose-800">Access Restricted</h2>
        <p className="text-xs text-slate-600">
          Gym operational expenses and financial cash flows are confidential and only accessible by the Owner account.
        </p>
        <a href="/dashboard" className="inline-block text-xs text-indigo-600 font-semibold underline">
          Return to Dashboard
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="pb-3 border-b border-slate-200">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
          Gym Expenses & Recurring Outflows
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Track rent, utility bills, salaries, maintenance, and post recurring templates with month-locking protection
        </p>
      </div>

      <ExpensesLedgerView />
    </div>
  );
}

