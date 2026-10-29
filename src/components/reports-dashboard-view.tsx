"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  BarChart3,
  Download,
  Printer,
  Calendar,
  IndianRupee,
  TrendingUp,
  AlertTriangle,
  RefreshCw,
  Users,
  CheckCircle2,
  FileSpreadsheet,
} from "lucide-react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Input } from "./ui/input";
import { formatINR } from "@/lib/money";
import { getTodayISTString, addDays } from "@/lib/dates";

export default function ReportsDashboardView() {
  const today = getTodayISTString();
  const currentMonthStart = `${today.slice(0, 7)}-01`;

  const [startDate, setStartDate] = useState(currentMonthStart);
  const [endDate, setEndDate] = useState(today);
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/reports/financial?startDate=${startDate}&endDate=${endDate}`
      );
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const handleExportCsv = () => {
    window.location.href = `/api/reports/export-csv?startDate=${startDate}&endDate=${endDate}`;
  };

  return (
    <div className="space-y-6">
      {/* Date Filter & Export Controls (Hidden on print) */}
      <Card className="no-print p-4 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-700">From:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-9 px-2.5 rounded border border-slate-300 text-xs focus:ring-2 focus:ring-indigo-600 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-700">To:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-9 px-2.5 rounded border border-slate-300 text-xs focus:ring-2 focus:ring-indigo-600 focus:outline-none"
              />
            </div>

            {/* Presets */}
            <div className="flex items-center gap-1.5 text-xs">
              <button
                onClick={() => {
                  setStartDate(today);
                  setEndDate(today);
                }}
                className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700"
              >
                Today
              </button>
              <button
                onClick={() => {
                  setStartDate(currentMonthStart);
                  setEndDate(today);
                }}
                className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700"
              >
                This Month
              </button>
              <button
                onClick={() => {
                  setStartDate(addDays(today, -30));
                  setEndDate(today);
                }}
                className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700"
              >
                Last 30 Days
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCsv}
              className="text-xs gap-1.5 border-slate-300"
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-700" />
              <span>Export CSV (Safe)</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => window.print()}
              className="text-xs gap-1.5 border-slate-300"
            >
              <Printer className="h-4 w-4 text-slate-600" />
              <span>Print Statement</span>
            </Button>
          </div>
        </div>
      </Card>

      {/* Main Report Body */}
      {loading && !data ? (
        <div className="py-16 text-center">
          <div className="inline-block animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full" />
          <p className="text-xs text-slate-500 mt-2">Computing financial statements...</p>
        </div>
      ) : !data ? (
        <p className="text-xs text-slate-500 py-8 text-center">Unable to load report data.</p>
      ) : (
        <div className="space-y-6">
          {/* Executive Cash Flow Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card className="border-t-4 border-t-indigo-600">
              <CardContent className="p-4 space-y-1">
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Gross Collections
                </span>
                <div className="text-2xl font-bold text-slate-900">
                  {formatINR(data.grossCollectionsPaise)}
                </div>
                <p className="text-[11px] text-slate-500">
                  Total incoming payments received in period
                </p>
              </CardContent>
            </Card>

            <Card className="border-t-4 border-t-rose-500">
              <CardContent className="p-4 space-y-1">
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Refunds Deductions
                </span>
                <div className="text-2xl font-bold text-rose-700">
                  - {formatINR(data.totalRefundsPaise)}
                </div>
                <p className="text-[11px] text-slate-500">
                  Owner-approved fee refunds posted in period
                </p>
              </CardContent>
            </Card>

            <Card className="border-t-4 border-t-emerald-600">
              <CardContent className="p-4 space-y-1">
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Net Collections
                </span>
                <div className="text-2xl font-bold text-emerald-800">
                  {formatINR(data.netCollectionsPaise)}
                </div>
                <p className="text-[11px] text-slate-500">Gross collections minus refunds</p>
              </CardContent>
            </Card>

            <Card className="border-t-4 border-t-slate-500">
              <CardContent className="p-4 space-y-1">
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Recorded Expenses
                </span>
                <div className="text-2xl font-bold text-slate-800">
                  - {formatINR(data.totalExpensesPaise)}
                </div>
                <p className="text-[11px] text-slate-500">
                  Operational disbursements paid in period
                </p>
              </CardContent>
            </Card>

            <Card className="border-t-4 border-t-blue-600 bg-blue-50/20">
              <CardContent className="p-4 space-y-1">
                <span className="text-xs font-medium text-blue-900 uppercase tracking-wider">
                  Cash Surplus
                </span>
                <div
                  className={`text-2xl font-bold ${
                    data.cashSurplusPaise >= 0 ? "text-blue-900" : "text-rose-700"
                  }`}
                >
                  {formatINR(data.cashSurplusPaise)}
                </div>
                <p className="text-[11px] text-blue-800">
                  Net Collections minus Paid Expenses
                </p>
              </CardContent>
            </Card>

            <Card className="border-t-4 border-t-amber-500">
              <CardContent className="p-4 space-y-1">
                <span className="text-xs font-medium text-amber-900 uppercase tracking-wider">
                  Total Outstanding Dues
                </span>
                <div className="text-2xl font-bold text-amber-900">
                  {formatINR(data.totalOutstandingDuesPaise)}
                </div>
                <p className="text-[11px] text-amber-700">
                  All active uncollected fee balances
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Breakdown Section: Payment Methods & Expense Categories */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Payment Mode Distribution
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                {Object.entries(data.paymentMethodTotals || {}).map(([mode, amt]: any) => (
                  <div key={mode} className="flex justify-between py-1 border-b border-slate-100">
                    <span className="font-semibold text-slate-700">{mode}:</span>
                    <strong className="text-slate-900">{formatINR(amt)}</strong>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Operational Activity & Visits
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-600">New Members Enrolled in Period:</span>
                  <strong className="text-slate-900">{data.counts.newMembersCount}</strong>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-600">Renewal Terms Booked:</span>
                  <strong className="text-slate-900">{data.counts.renewalCount}</strong>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-600">Total Check-in Visits Recorded:</span>
                  <strong className="text-slate-900">{data.counts.attendanceCount}</strong>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Staff Collection Breakdown */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Staff Desk Collection Breakdown
              </CardTitle>
            </CardHeader>
            {data.staffCollections?.length === 0 ? (
              <p className="p-6 text-center text-xs text-slate-500">
                No collections recorded in this period.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-semibold uppercase">
                    <tr>
                      <th className="py-2.5 px-4">Staff Member</th>
                      <th className="py-2.5 px-4">Transactions Handled</th>
                      <th className="py-2.5 px-4 text-right">Total Amount Collected</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.staffCollections.map((s: any) => (
                      <tr key={s.staffId}>
                        <td className="py-3 px-4 font-semibold text-slate-900">{s.staffName}</td>
                        <td className="py-3 px-4 text-slate-600">{s.transactionCount} payments</td>
                        <td className="py-3 px-4 text-right font-bold text-slate-900">
                          {formatINR(s.collectedPaise)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
