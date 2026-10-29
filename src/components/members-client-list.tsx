"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Search,
  Phone,
  Calendar,
  AlertTriangle,
  ChevronRight,
  Filter,
  RefreshCw,
  CheckCircle2,
  CreditCard,
  RotateCcw,
} from "lucide-react";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { StatusBadge, Badge } from "./ui/badge";
import { formatINR } from "@/lib/money";
import { formatDisplayDate } from "@/lib/dates";

interface MemberItem {
  id: string;
  memberCode: string;
  name: string;
  phone: string;
  email: string | null;
  isArchived: boolean;
  createdAt: string;
  latestTerm: {
    status: string;
    validThrough: string;
    planName: string;
  } | null;
  balancePaise: number;
}

interface MembersClientListProps {
  initialSearch: string;
  initialStatus: string;
  userRole: string;
}

export default function MembersClientList({
  initialSearch,
  initialStatus,
  userRole,
}: MembersClientListProps) {
  const [search, setSearch] = useState(initialSearch);
  const [debouncedSearch, setDebouncedSearch] = useState(initialSearch);
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [page, setPage] = useState(1);
  const [members, setMembers] = useState<MemberItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Debounce search input by 300ms
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [search]);

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (statusFilter) params.set("status", statusFilter);
      params.set("page", String(page));
      params.set("limit", "15");

      const res = await fetch(`/api/members?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setMembers(data.members || []);
        setTotalPages(data.pagination?.totalPages || 1);
        setTotalCount(data.pagination?.totalCount || 0);
      }
    } catch (err) {
      console.error("fetchMembers error:", err);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, statusFilter, page]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const filterTabs = [
    { label: "All Members", value: "" },
    { label: "Active", value: "ACTIVE" },
    { label: "Archived", value: "ARCHIVED" },
  ];

  return (
    <div className="space-y-4">
      {/* Search & Filter Bar */}
      <Card className="p-4 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Search className="h-4 w-4" />
            </div>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by member ID (e.g. MEM-1001), name, or mobile number..."
              className="flex h-10 w-full min-h-[44px] rounded-md border border-slate-300 bg-white pl-9 pr-8 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                title="Clear search"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            {filterTabs.map((tab) => (
              <button
                key={tab.value}
                onClick={() => {
                  setStatusFilter(tab.value);
                  setPage(1);
                }}
                className={`px-3 py-2 rounded-md text-xs font-medium whitespace-nowrap min-h-[40px] transition-colors ${
                  statusFilter === tab.value
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {tab.label}
              </button>
            ))}

            {(search || statusFilter) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch("");
                  setStatusFilter("");
                  setPage(1);
                }}
                className="text-xs text-slate-500 hover:text-slate-800 gap-1"
                title="Reset filters"
              >
                <RotateCcw className="h-3 w-3" />
                <span>Reset</span>
              </Button>
            )}
          </div>
        </div>

        {/* Applied filters info */}
        <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-100">
          <span>
            Showing <strong className="text-slate-800">{members.length}</strong> of{" "}
            <strong className="text-slate-800">{totalCount}</strong> members
            {debouncedSearch && ` matching "${debouncedSearch}"`}
          </span>
          {loading && (
            <span className="flex items-center gap-1.5 text-indigo-600 font-medium">
              <RefreshCw className="h-3 w-3 animate-spin" />
              <span>Updating...</span>
            </span>
          )}
        </div>
      </Card>

      {/* Member Records List */}
      {loading && members.length === 0 ? (
        <div className="py-16 text-center">
          <div className="inline-block animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full" />
          <p className="text-xs text-slate-500 mt-2">Loading member directory...</p>
        </div>
      ) : members.length === 0 ? (
        <Card className="py-12 text-center p-6">
          <p className="text-sm font-semibold text-slate-700">No members found</p>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {search || statusFilter
              ? "No member matches the current search keywords or filters. Try clearing filters or searching with a different name/phone."
              : "No members have been added to the gym directory yet."}
          </p>
          <div className="mt-4">
            <Link href="/members/new">
              <Button size="sm">Enroll First Member</Button>
            </Link>
          </div>
        </Card>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden md:block bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
            <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Member ID & Name</th>
                  <th className="py-3 px-4">Phone Number</th>
                  <th className="py-3 px-4">Plan & Expiry</th>
                  <th className="py-3 px-4">Membership Status</th>
                  <th className="py-3 px-4">Balance Due</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {members.map((m) => (
                  <tr
                    key={m.id}
                    className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                  >
                    <td className="py-3.5 px-4">
                      <Link href={`/members/${m.id}`} className="block">
                        <div className="font-semibold text-slate-900 group-hover:text-indigo-600">
                          {m.name}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          {m.memberCode}
                        </div>
                      </Link>
                    </td>

                    <td className="py-3.5 px-4 text-slate-700 font-mono">
                      {m.phone}
                    </td>

                    <td className="py-3.5 px-4">
                      {m.latestTerm ? (
                        <div>
                          <div className="font-medium text-slate-800">
                            {m.latestTerm.planName}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            Valid through: {formatDisplayDate(m.latestTerm.validThrough)}
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">No term booked</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      {m.isArchived ? (
                        <Badge variant="neutral">Archived</Badge>
                      ) : m.latestTerm ? (
                        <StatusBadge status={m.latestTerm.status} />
                      ) : (
                        <Badge variant="neutral">No Plan</Badge>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      {m.balancePaise > 0 ? (
                        <Badge variant="warning" className="font-semibold">
                          {formatINR(m.balancePaise)} Due
                        </Badge>
                      ) : (
                        <span className="text-emerald-700 font-medium">₹0 (Paid)</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <Link href={`/members/${m.id}`}>
                        <Button variant="outline" size="sm" className="h-8 text-xs">
                          Open Profile →
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View (Generous Touch Targets) */}
          <div className="md:hidden space-y-3">
            {members.map((m) => (
              <Link key={m.id} href={`/members/${m.id}`} className="block">
                <Card className="hover:border-indigo-300 transition-colors p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-bold text-sm text-slate-900">{m.name}</div>
                      <div className="text-xs text-slate-500 font-mono mt-0.5">
                        {m.memberCode} • {m.phone}
                      </div>
                    </div>
                    {m.isArchived ? (
                      <Badge variant="neutral">Archived</Badge>
                    ) : m.latestTerm ? (
                      <StatusBadge status={m.latestTerm.status} />
                    ) : null}
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
                    <div>
                      {m.latestTerm ? (
                        <span className="text-slate-600">
                          {m.latestTerm.planName} • Exp: {formatDisplayDate(m.latestTerm.validThrough)}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">No term</span>
                      )}
                    </div>
                    <div>
                      {m.balancePaise > 0 ? (
                        <Badge variant="warning" className="font-bold">
                          {formatINR(m.balancePaise)} Due
                        </Badge>
                      ) : (
                        <span className="text-emerald-700 font-medium text-[11px]">Paid</span>
                      )}
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                Previous
              </Button>
              <span className="text-xs text-slate-600 font-medium">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
