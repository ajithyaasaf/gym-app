"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Building2,
  Tag,
  Users,
  ShieldCheck,
  Plus,
  Key,
  UserX,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Input } from "./ui/input";
import { formatINR, rupeesToPaise } from "@/lib/money";
import { formatDisplayDate } from "@/lib/dates";

interface SettingsHubViewProps {
  userRole: string;
}

export default function SettingsHubView({ userRole }: SettingsHubViewProps) {
  const isOwner = userRole === "OWNER";
  const [activeTab, setActiveTab] = useState<"gym" | "plans" | "staff" | "audit">("gym");

  // Gym Settings Form State
  const [gymName, setGymName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [receiptPrefix, setReceiptPrefix] = useState("REC");
  const [absenceThreshold, setAbsenceThreshold] = useState("10");
  const [taxEnabled, setTaxEnabled] = useState(false);
  const [taxName, setTaxName] = useState("GST");
  const [taxIdNumber, setTaxIdNumber] = useState("");
  const [savingGym, setSavingGym] = useState(false);

  // Plans State
  const [plansList, setPlansList] = useState<any[]>([]);
  const [showAddPlan, setShowAddPlan] = useState(false);
  const [newPlanName, setNewPlanName] = useState("");
  const [newPlanDesc, setNewPlanDesc] = useState("");
  const [newPlanUnit, setNewPlanUnit] = useState("MONTHS");
  const [newPlanQty, setNewPlanQty] = useState("1");
  const [newPlanPrice, setNewPlanPrice] = useState("");
  const [newPlanJoining, setNewPlanJoining] = useState("0");
  const [savingPlan, setSavingPlan] = useState(false);

  // Staff State
  const [staffList, setStaffList] = useState<any[]>([]);
  const [showAddStaff, setShowAddStaff] = useState(false);
  const [newStaffName, setNewStaffName] = useState("");
  const [newStaffEmail, setNewStaffEmail] = useState("");
  const [newStaffRole, setNewStaffRole] = useState("STAFF");
  const [createdStaffCreds, setCreatedStaffCreds] = useState<any | null>(null);
  const [savingStaff, setSavingStaff] = useState(false);

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);

  const fetchGymSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/gym");
      if (res.ok) {
        const s = await res.json();
        setGymName(s.gymName || "");
        setPhone(s.phone || "");
        setEmail(s.email || "");
        setAddress(s.address || "");
        setReceiptPrefix(s.receiptPrefix || "REC");
        setAbsenceThreshold(String(s.absenceThresholdDays || 10));
        setTaxEnabled(!!s.taxEnabled);
        setTaxName(s.taxName || "GST");
        setTaxIdNumber(s.taxIdNumber || "");
      }
    } catch (err) {
      console.error(err);
    }
  }, []);

  const fetchPlans = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/plans");
      if (res.ok) {
        const json = await res.json();
        setPlansList(json.plans || []);
      }
    } catch (err) {
      console.error(err);
    }
  }, []);

  const fetchStaff = useCallback(async () => {
    if (!isOwner) return;
    try {
      const res = await fetch("/api/settings/staff");
      if (res.ok) {
        const json = await res.json();
        setStaffList(json.staff || []);
      }
    } catch (err) {
      console.error(err);
    }
  }, [isOwner]);

  const fetchAudit = useCallback(async () => {
    if (!isOwner) return;
    setLoadingAudit(true);
    try {
      const res = await fetch("/api/settings/audit");
      if (res.ok) {
        const json = await res.json();
        setAuditLogs(json.logs || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingAudit(false);
    }
  }, [isOwner]);

  useEffect(() => {
    fetchGymSettings();
    fetchPlans();
    if (isOwner) {
      fetchStaff();
      fetchAudit();
    }
  }, [fetchGymSettings, fetchPlans, fetchStaff, fetchAudit, isOwner]);

  const handleSaveGymSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingGym(true);
    try {
      const res = await fetch("/api/settings/gym", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gymName,
          phone,
          email,
          address,
          receiptPrefix,
          absenceThresholdDays: Number(absenceThreshold),
          taxEnabled,
          taxName,
          taxIdNumber,
        }),
      });

      if (res.ok) {
        alert("Gym settings updated successfully!");
      } else {
        const data = await res.json();
        alert(data.error || "Failed to update settings");
      }
    } catch {
      alert("Network error.");
    } finally {
      setSavingGym(false);
    }
  };

  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPlan(true);
    try {
      const res = await fetch("/api/settings/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newPlanName,
          description: newPlanDesc,
          durationUnit: newPlanUnit,
          durationQuantity: Number(newPlanQty),
          pricePaise: rupeesToPaise(newPlanPrice),
          joiningFeePaise: rupeesToPaise(newPlanJoining || 0),
        }),
      });

      if (res.ok) {
        setShowAddPlan(false);
        setNewPlanName("");
        setNewPlanPrice("");
        fetchPlans();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to create plan");
      }
    } catch {
      alert("Network error.");
    } finally {
      setSavingPlan(false);
    }
  };

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingStaff(true);
    try {
      const res = await fetch("/api/settings/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newStaffName,
          email: newStaffEmail,
          role: newStaffRole,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setShowAddStaff(false);
        setCreatedStaffCreds(data);
        setNewStaffName("");
        setNewStaffEmail("");
        fetchStaff();
      } else {
        alert(data.error || "Failed to create staff account");
      }
    } catch {
      alert("Network error.");
    } finally {
      setSavingStaff(false);
    }
  };

  const handleResetPassword = async (userId: string, staffName: string) => {
    const confirmReset = confirm(`Reset password for staff member ${staffName}?`);
    if (!confirmReset) return;

    try {
      const res = await fetch("/api/settings/staff", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "RESET_PASSWORD", userId }),
      });

      const data = await res.json();
      if (res.ok) {
        alert(
          `Temporary setup password generated:\n\nPassword: ${data.tempPassword}\n\nPlease share this with the staff member. It expires in 48 hours.`
        );
      } else {
        alert(data.error || "Failed to reset password");
      }
    } catch {
      alert("Network error.");
    }
  };

  const handleDeactivateStaff = async (userId: string, staffName: string) => {
    const confirmDeact = confirm(
      `Deactivate account for ${staffName}? They will be immediately signed out and blocked from logging in.`
    );
    if (!confirmDeact) return;

    try {
      const res = await fetch("/api/settings/staff", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "DEACTIVATE", userId }),
      });

      const data = await res.json();
      if (res.ok) {
        alert("Account deactivated.");
        fetchStaff();
      } else {
        alert(data.error || "Failed to deactivate account");
      }
    } catch {
      alert("Network error.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Navigation Subtabs */}
      <div className="flex items-center gap-1 border-b border-slate-200 overflow-x-auto">
        {[
          { id: "gym", label: "Gym Profile & Prefix", icon: Building2 },
          { id: "plans", label: `Plans Catalogue (${plansList.length})`, icon: Tag },
          ...(isOwner
            ? [
                { id: "staff", label: `Staff Accounts (${staffList.length})`, icon: Users },
                { id: "audit", label: "Audit History", icon: ShieldCheck },
              ]
            : []),
        ].map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors ${
                activeTab === t.id
                  ? "border-indigo-600 text-indigo-700 bg-indigo-50/50"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: GYM PROFILE & CONFIGURATION */}
      {activeTab === "gym" && (
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle className="text-sm">Gym Business Details & Preferences</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSaveGymSettings} className="space-y-4">
              <Input
                label="Gym Brand Name *"
                required
                value={gymName}
                onChange={(e) => setGymName(e.target.value)}
                disabled={!isOwner}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Contact Phone Number *"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={!isOwner}
                />
                <Input
                  label="Official Email *"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={!isOwner}
                />
              </div>

              <Input
                label="Gym Physical Address *"
                required
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                disabled={!isOwner}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                <Input
                  label="Receipt Number Prefix"
                  value={receiptPrefix}
                  onChange={(e) => setReceiptPrefix(e.target.value)}
                  disabled={!isOwner}
                  helperText="Prefix used in official receipt numbering (e.g. REC)"
                />

                <Input
                  label="Absence Threshold (Days)"
                  type="number"
                  min="1"
                  value={absenceThreshold}
                  onChange={(e) => setAbsenceThreshold(e.target.value)}
                  disabled={!isOwner}
                  helperText="Active members with no check-in for N days appear in absent follow-ups"
                />
              </div>

              {/* Invoicing Details */}
              <div className="pt-2 border-t border-slate-100 space-y-3">
                <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={taxEnabled}
                    onChange={(e) => setTaxEnabled(e.target.checked)}
                    disabled={!isOwner}
                    className="h-4 w-4 text-indigo-600 rounded"
                  />
                  <span>Enable Tax / GST Invoicing details on printed receipts</span>
                </label>

                {taxEnabled && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                    <Input
                      label="Tax Registration Number (e.g. GSTIN)"
                      value={taxIdNumber}
                      onChange={(e) => setTaxIdNumber(e.target.value)}
                      disabled={!isOwner}
                    />
                    <Input
                      label="Tax Label"
                      value={taxName}
                      onChange={(e) => setTaxName(e.target.value)}
                      disabled={!isOwner}
                    />
                  </div>
                )}
              </div>

              {isOwner && (
                <div className="flex justify-end pt-3">
                  <Button type="submit" isLoading={savingGym}>
                    Save Settings
                  </Button>
                </div>
              )}
            </form>
          </CardContent>
        </Card>
      )}

      {/* TAB 2: PLANS CATALOGUE */}
      {activeTab === "plans" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">
              Editing or archiving plans applies only to newly sold memberships. Historical terms remain preserved.
            </p>
            {isOwner && (
              <Button size="sm" onClick={() => setShowAddPlan(true)} className="text-xs gap-1">
                <Plus className="h-4 w-4" />
                <span>Add Membership Plan</span>
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {plansList.map((p) => (
              <Card key={p.id} className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="font-bold text-sm text-slate-900">{p.name}</div>
                  <Badge variant={p.isActive ? "success" : "neutral"}>
                    {p.isActive ? "Active" : "Archived"}
                  </Badge>
                </div>

                <div className="text-2xl font-bold text-slate-900">
                  {formatINR(p.pricePaise)}
                  <span className="text-xs font-normal text-slate-500 ml-1">
                    / {p.durationQuantity} {p.durationUnit.toLowerCase()}
                  </span>
                </div>

                {p.joiningFeePaise > 0 && (
                  <div className="text-xs text-slate-500">
                    One-time Joining Fee: <strong>{formatINR(p.joiningFeePaise)}</strong>
                  </div>
                )}

                {p.description && (
                  <p className="text-xs text-slate-600 line-clamp-2">{p.description}</p>
                )}
              </Card>
            ))}
          </div>

          {/* Add Plan Modal */}
          {showAddPlan && (
            <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
              <Card className="max-w-md w-full p-6 shadow-xl space-y-4">
                <h3 className="text-base font-bold text-slate-900">Add New Plan</h3>
                <form onSubmit={handleCreatePlan} className="space-y-3">
                  <Input
                    label="Plan Name *"
                    required
                    value={newPlanName}
                    onChange={(e) => setNewPlanName(e.target.value)}
                    placeholder="e.g. 3 Months Strength Pack"
                  />

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Duration Unit *
                      </label>
                      <select
                        value={newPlanUnit}
                        onChange={(e) => setNewPlanUnit(e.target.value)}
                        className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                      >
                        <option value="MONTHS">Calendar Months</option>
                        <option value="DAYS">Days</option>
                      </select>
                    </div>

                    <Input
                      label="Duration Quantity *"
                      type="number"
                      min="1"
                      required
                      value={newPlanQty}
                      onChange={(e) => setNewPlanQty(e.target.value)}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      label="Fee Price (₹) *"
                      type="number"
                      required
                      min="1"
                      value={newPlanPrice}
                      onChange={(e) => setNewPlanPrice(e.target.value)}
                      placeholder="e.g. 4000"
                    />

                    <Input
                      label="Joining Fee (₹)"
                      type="number"
                      min="0"
                      value={newPlanJoining}
                      onChange={(e) => setNewPlanJoining(e.target.value)}
                      placeholder="0"
                    />
                  </div>

                  <Input
                    label="Description (Optional)"
                    value={newPlanDesc}
                    onChange={(e) => setNewPlanDesc(e.target.value)}
                    placeholder="e.g. Full equipment access"
                  />

                  <div className="flex justify-end gap-2 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowAddPlan(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" isLoading={savingPlan}>
                      Save Plan
                    </Button>
                  </div>
                </form>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: STAFF MANAGEMENT (OWNER ONLY) */}
      {activeTab === "staff" && isOwner && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">
              Staff accounts have operational reception access. Deactivation immediately revokes active sessions.
            </p>
            <Button size="sm" onClick={() => setShowAddStaff(true)} className="text-xs gap-1">
              <Plus className="h-4 w-4" />
              <span>Create Staff Account</span>
            </Button>
          </div>

          {createdStaffCreds && (
            <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-lg text-xs space-y-2">
              <div className="flex items-center gap-2 font-bold text-emerald-900">
                <CheckCircle2 className="h-4 w-4 text-emerald-700" />
                <span>New Staff Account Credentials Generated</span>
              </div>
              <p className="text-emerald-800">
                Email: <strong>{createdStaffCreds.email}</strong> | Setup Password:{" "}
                <strong className="font-mono bg-white px-2 py-0.5 rounded border border-emerald-300">
                  {createdStaffCreds.tempPassword}
                </strong>
              </p>
              <p className="text-[11px] text-emerald-700">
                Please provide this one-time password to the staff member. They will be prompted to set a permanent password upon sign-in.
              </p>
            </div>
          )}

          <Card className="divide-y divide-slate-100 text-xs">
            {staffList.map((s) => (
              <div
                key={s.id}
                className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
              >
                <div>
                  <div className="font-bold text-sm text-slate-900 flex items-center gap-2">
                    <span>{s.name}</span>
                    <Badge variant={s.role === "OWNER" ? "default" : "neutral"}>
                      {s.role}
                    </Badge>
                    {!s.isActive && <Badge variant="destructive">Deactivated</Badge>}
                  </div>
                  <div className="text-slate-500 font-mono text-[11px] mt-0.5">{s.email}</div>
                </div>

                <div className="flex items-center gap-2">
                  {s.isActive && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleResetPassword(s.id, s.name)}
                        className="h-8 text-xs gap-1"
                      >
                        <Key className="h-3 w-3" />
                        <span>Reset Password</span>
                      </Button>

                      {s.role !== "OWNER" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeactivateStaff(s.id, s.name)}
                          className="h-8 text-xs text-rose-600 hover:bg-rose-50 gap-1"
                        >
                          <UserX className="h-3 w-3" />
                          <span>Deactivate</span>
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
          </Card>

          {/* Add Staff Modal */}
          {showAddStaff && (
            <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
              <Card className="max-w-md w-full p-6 shadow-xl space-y-4">
                <h3 className="text-base font-bold text-slate-900">
                  Create Staff Account
                </h3>
                <form onSubmit={handleCreateStaff} className="space-y-3">
                  <Input
                    label="Staff Member Full Name *"
                    required
                    value={newStaffName}
                    onChange={(e) => setNewStaffName(e.target.value)}
                    placeholder="e.g. Kavita Sundaram"
                  />

                  <Input
                    label="Login Email Address *"
                    type="email"
                    required
                    value={newStaffEmail}
                    onChange={(e) => setNewStaffEmail(e.target.value)}
                    placeholder="kavita@ironpulse.in"
                  />

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Account Role
                    </label>
                    <select
                      value={newStaffRole}
                      onChange={(e) => setNewStaffRole(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                    >
                      <option value="STAFF">STAFF (Reception & Operational Access)</option>
                      <option value="OWNER">OWNER (Full Administrative & Financial Access)</option>
                    </select>
                  </div>

                  <p className="text-[11px] text-slate-500">
                    A secure one-time password will be generated automatically for initial setup.
                  </p>

                  <div className="flex justify-end gap-2 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowAddStaff(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" isLoading={savingStaff}>
                      Create Account
                    </Button>
                  </div>
                </form>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: AUDIT HISTORY (OWNER ONLY) */}
      {activeTab === "audit" && isOwner && (
        <Card className="divide-y divide-slate-100 text-xs">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              System Audit Event Logs (Latest 100)
            </h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchAudit}
              className="text-xs text-indigo-600 gap-1"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Refresh</span>
            </Button>
          </div>

          {loadingAudit ? (
            <p className="p-8 text-center text-xs text-slate-500">Loading audit history...</p>
          ) : auditLogs.length === 0 ? (
            <p className="p-8 text-center text-xs text-slate-500">No audit logs recorded yet.</p>
          ) : (
            auditLogs.map((l) => (
              <div key={l.id} className="p-3.5 space-y-1 hover:bg-slate-50/60">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="default" className="text-[10px]">
                      {l.action}
                    </Badge>
                    <span className="font-semibold text-slate-800">
                      {l.entityType} ({l.entityId})
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono">
                    {new Intl.DateTimeFormat("en-IN", {
                      timeZone: "Asia/Kolkata",
                      dateStyle: "short",
                      timeStyle: "medium",
                    }).format(new Date(l.createdAt))}
                  </span>
                </div>

                <div className="text-[11px] text-slate-500">
                  Actor: <strong className="text-slate-700">{l.actorName || "System / API"}</strong>
                  {l.reason && ` • Reason: "${l.reason}"`}
                </div>

                {l.detailsJson && (
                  <pre className="text-[10px] text-slate-600 font-mono bg-slate-50 p-2 rounded overflow-x-auto max-h-20">
                    {l.detailsJson}
                  </pre>
                )}
              </div>
            ))
          )}
        </Card>
      )}
    </div>
  );
}

