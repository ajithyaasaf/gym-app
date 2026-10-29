import { getCurrentSession } from "@/lib/auth";
import AttendanceDeskView from "@/components/attendance-desk-view";

export default async function AttendancePage() {
  const current = await getCurrentSession();

  return (
    <div className="space-y-6">
      <div className="pb-3 border-b border-slate-200">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
          Front Desk Attendance
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Fast check-in, real-time fee dues alerts, daily visit logs, and owner exception approvals
        </p>
      </div>

      <AttendanceDeskView userRole={current?.user.role || "STAFF"} />
    </div>
  );
}

