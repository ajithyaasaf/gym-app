"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Search,
  CheckCircle2,
  AlertTriangle,
  Clock,
  UserCheck,
  ShieldAlert,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { StatusBadge, Badge } from "./ui/badge";
import { Input } from "./ui/input";
import { formatINR } from "@/lib/money";
import { formatDisplayDate, getTodayISTString } from "@/lib/dates";

interface AttendanceRecord {
  id: string;
  memberId: string;
  memberName: string;
  memberCode: string;
  memberPhone: string;
  attendanceDate: string;
  checkInTime: string;
  isException: boolean;
  exceptionReason: string | null;
  isVoided: boolean;
  voidReason: string | null;
  markedByName: string;
}

interface AttendanceDeskViewProps {
  userRole: string;
}

export default function AttendanceDeskView({ userRole }: AttendanceDeskViewProps) {
  const isOwner = userRole === "OWNER";
  const [search, setSearch] = useState("");
  const [candidates, setCandidates] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedMember, setSelectedMember] = useState<any | null>(null);

  // Exception state for non-active members
  const [exceptionReason, setExceptionReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Today's attendance list
  const [todayList, setTodayList] = useState<AttendanceRecord[]>([]);
  const [loadingList, setLoadingList] = useState(true);

  const fetchTodayAttendance = useCallback(async () => {
    setLoadingList(true);
    try {
      const res = await fetch(`/api/attendance?date=${getTodayISTString()}`);
      if (res.ok) {
        const json = await res.json();
        setTodayList(json.attendance || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    fetchTodayAttendance();
  }, [fetchTodayAttendance]);

  // Debounced search for candidate members
  useEffect(() => {
    if (!search.trim()) {
      setCandidates([]);
      return;
    }

    const handler = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/members?search=${encodeURIComponent(search.trim())}&limit=5`);
        if (res.ok) {
          const json = await res.json();
          setCandidates(json.members || []);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setSearching(false);
      }
    }, 250);

    return () => clearTimeout(handler);
  }, [search]);

  const handleMarkAttendance = async (member: any, isException = false) => {
    setStatusMessage(null);
    setSubmitting(true);

    try {
      const res = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberId: member.id,
          attendanceDate: getTodayISTString(),
          isException,
          exceptionReason: isException ? exceptionReason : undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setStatusMessage({
          type: "error",
          text: data.error || "Failed to mark attendance.",
        });
        setSubmitting(false);
        return;
      }

      setStatusMessage({
        type: "success",
        text: data.isExisting
          ? `${member.name} was already checked in for today!`
          : `✓ ${member.name} checked in successfully!`,
      });

      // Clear search and candidate selection
      setSearch("");
      setCandidates([]);
      setSelectedMember(null);
      setExceptionReason("");
      fetchTodayAttendance();
    } catch {
      setStatusMessage({
        type: "error",
        text: "Network error occurred while recording attendance.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleVoid = async (attendanceId: string) => {
    const reason = prompt("Enter the audit reason for voiding this attendance record:");
    if (!reason || !reason.trim()) return;

    try {
      const res = await fetch(`/api/attendance/${attendanceId}/void`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voidReason: reason.trim() }),
      });

      if (res.ok) {
        alert("Attendance record voided successfully.");
        fetchTodayAttendance();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to void attendance.");
      }
    } catch {
      alert("Network error.");
    }
  };

  const validVisitsCount = todayList.filter((a) => !a.isVoided).length;

  return (
    <div className="space-y-6">
      {/* Top Front Desk Check-in Box */}
      <Card className="border-indigo-200 shadow-sm">
        <CardHeader className="bg-indigo-50/50 pb-3">
          <CardTitle className="text-sm font-bold text-indigo-950 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-indigo-600" />
              <span>One-Tap Member Check-in</span>
            </span>
            <Badge variant="default" className="text-xs">
              Today: {validVisitsCount} Visits
            </Badge>
          </CardTitle>
        </CardHeader>

        <CardContent className="p-5 space-y-4">
          {statusMessage && (
            <div
              className={`p-3 rounded-lg text-xs font-medium flex items-center gap-2 ${
                statusMessage.type === "success"
                  ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                  : "bg-rose-50 text-rose-800 border border-rose-200"
              }`}
            >
              {statusMessage.type === "success" ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
              )}
              <span>{statusMessage.text}</span>
            </div>
          )}

          {/* Search Member Input */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Search className="h-4 w-4" />
            </div>
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setSelectedMember(null);
              }}
              placeholder="Type member name, phone (e.g. 98765...), or Member ID (MEM-1001)..."
              className="flex h-11 w-full min-h-[44px] rounded-md border border-slate-300 bg-white pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 shadow-sm"
              autoFocus
            />
          </div>

          {/* Search Candidate Dropdown List */}
          {candidates.length > 0 && !selectedMember && (
            <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 bg-white shadow-sm overflow-hidden text-xs">
              {candidates.map((m) => {
                const isMemberActive = m.latestTerm?.status === "ACTIVE";

                return (
                  <div
                    key={m.id}
                    onClick={() => setSelectedMember(m)}
                    className="p-3 hover:bg-indigo-50/60 cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-2 transition-colors"
                  >
                    <div>
                      <div className="font-bold text-slate-900 text-sm">
                        {m.name} <span className="font-mono text-xs font-normal text-slate-500">({m.memberCode})</span>
                      </div>
                      <div className="text-slate-500 font-mono mt-0.5">
                        {m.phone}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {m.latestTerm ? (
                        <StatusBadge status={m.latestTerm.status} />
                      ) : (
                        <Badge variant="neutral">No Term</Badge>
                      )}

                      {m.balancePaise > 0 && (
                        <Badge variant="warning" className="font-semibold">
                          {formatINR(m.balancePaise)} Due
                        </Badge>
                      )}

                      <Button size="sm" className="h-8 text-xs ml-2">
                        Select Member
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Selected Member Detail & Confirmation Box */}
          {selectedMember && (
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-4 text-xs">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {selectedMember.name}
                  </h3>
                  <p className="text-slate-500 font-mono">
                    {selectedMember.memberCode} • {selectedMember.phone}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {selectedMember.latestTerm ? (
                    <StatusBadge status={selectedMember.latestTerm.status} />
                  ) : (
                    <Badge variant="neutral">No Active Term</Badge>
                  )}
                  {selectedMember.balancePaise > 0 ? (
                    <Badge variant="warning" className="font-bold">
                      {formatINR(selectedMember.balancePaise)} Due
                    </Badge>
                  ) : (
                    <Badge variant="success">Fees Cleared</Badge>
                  )}
                </div>
              </div>

              {/* Status details & Warnings */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <span className="text-slate-500">Current Plan:</span>
                  <div className="font-semibold text-slate-800">
                    {selectedMember.latestTerm?.planName || "None"}
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-slate-500">Valid Through:</span>
                  <div className="font-semibold text-slate-800">
                    {formatDisplayDate(selectedMember.latestTerm?.validThrough)}
                  </div>
                </div>
              </div>

              {/* Due Warning Alert */}
              {selectedMember.balancePaise > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg flex items-center justify-between text-amber-900 text-xs">
                  <div className="flex items-center gap-2 font-medium">
                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                    <span>Member has an outstanding balance of {formatINR(selectedMember.balancePaise)}.</span>
                  </div>
                  <Link href={`/members/${selectedMember.id}`}>
                    <Button variant="outline" size="sm" className="h-7 text-xs bg-white">
                      Collect Fee
                    </Button>
                  </Link>
                </div>
              )}

              {/* Check-in Decision */}
              {selectedMember.latestTerm?.status === "ACTIVE" ? (
                <div className="flex items-center justify-end gap-3 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => setSelectedMember(null)}
                    disabled={submitting}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => handleMarkAttendance(selectedMember, false)}
                    isLoading={submitting}
                    className="bg-emerald-600 hover:bg-emerald-700 min-h-[44px] px-6 text-sm gap-2"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Confirm Attendance Check-in</span>
                  </Button>
                </div>
              ) : (
                /* Non-active member check-in block or Owner Exception */
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg space-y-3">
                  <div className="flex items-start gap-2 text-rose-800 font-semibold">
                    <ShieldAlert className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                    <span>
                      Cannot mark regular check-in: Member is currently{" "}
                      {selectedMember.latestTerm?.status || "without an active term"}.
                    </span>
                  </div>

                  {isOwner ? (
                    <div className="space-y-3 pt-1">
                      <p className="text-slate-600">
                        As the gym Owner, you may record an explicit one-off attendance exception with reason.
                      </p>
                      <Input
                        label="Owner Exception Reason *"
                        required
                        value={exceptionReason}
                        onChange={(e) => setExceptionReason(e.target.value)}
                        placeholder="e.g. Free guest trial pass, single session day pass"
                      />
                      <div className="flex justify-end gap-2 pt-1">
                        <Button
                          variant="outline"
                          onClick={() => setSelectedMember(null)}
                          disabled={submitting}
                        >
                          Dismiss
                        </Button>
                        <Button
                          disabled={!exceptionReason.trim()}
                          onClick={() => handleMarkAttendance(selectedMember, true)}
                          isLoading={submitting}
                          className="bg-amber-600 hover:bg-amber-700 text-white"
                        >
                          Approve Attendance Exception
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-slate-500 italic">
                      Staff cannot override non-active member check-ins. Please ask the member to renew their plan.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Today's Log of Completed Visits */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Today's Check-ins ({validVisitsCount} Unique Visits)
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchTodayAttendance}
            className="text-xs text-indigo-600 gap-1"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Refresh</span>
          </Button>
        </CardHeader>

        {loadingList ? (
          <p className="p-8 text-center text-xs text-slate-500">Loading today's visit log...</p>
        ) : todayList.length === 0 ? (
          <p className="p-8 text-center text-xs text-slate-500">
            No check-ins recorded yet today. Check-ins marked at reception will appear here.
          </p>
        ) : (
          <div className="divide-y divide-slate-100 text-xs">
            {todayList.map((a) => (
              <div
                key={a.id}
                className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:bg-slate-50/50"
              >
                <div className="flex items-center gap-3">
                  <CheckCircle2
                    className={`h-4 w-4 ${a.isVoided ? "text-slate-300" : "text-emerald-600"}`}
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/members/${a.memberId}`}
                        className={`font-semibold text-sm hover:underline ${
                          a.isVoided ? "line-through text-slate-400" : "text-slate-900"
                        }`}
                      >
                        {a.memberName}
                      </Link>
                      <span className="font-mono text-slate-500">({a.memberCode})</span>
                      {a.isException && <Badge variant="warning">Owner Exception</Badge>}
                      {a.isVoided && <Badge variant="destructive">Voided</Badge>}
                    </div>

                    <div className="text-slate-500 text-[11px] mt-0.5">
                      Marked by {a.markedByName} • Phone: {a.memberPhone}
                    </div>

                    {a.isException && a.exceptionReason && (
                      <div className="text-amber-800 text-[11px] mt-0.5 italic">
                        Exception: {a.exceptionReason}
                      </div>
                    )}

                    {a.isVoided && a.voidReason && (
                      <div className="text-rose-700 text-[11px] mt-0.5 italic">
                        Voided reason: {a.voidReason}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="font-mono text-slate-600 text-xs flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5 text-slate-400" />
                    {new Date(a.checkInTime).toLocaleTimeString("en-IN", {
                      timeZone: "Asia/Kolkata",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>

                  {isOwner && !a.isVoided && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleVoid(a.id)}
                      className="text-xs text-rose-600 hover:bg-rose-50 h-8"
                      title="Void this check-in"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
