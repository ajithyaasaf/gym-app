import { USER_ROLES, type UserRole } from "./constants";

export const PERMISSIONS = {
  VIEW_FINANCIAL_REPORTS: "VIEW_FINANCIAL_REPORTS",
  VIEW_EXPENSES: "VIEW_EXPENSES",
  MANAGE_EXPENSES: "MANAGE_EXPENSES",
  APPROVE_DISCOUNT: "APPROVE_DISCOUNT",
  ISSUE_REFUND: "ISSUE_REFUND",
  REVERSE_PAYMENT: "REVERSE_PAYMENT",
  OVERRIDE_MEMBERSHIP_DATES: "OVERRIDE_MEMBERSHIP_DATES",
  PAUSE_MEMBERSHIP: "PAUSE_MEMBERSHIP",
  CANCEL_MEMBERSHIP: "CANCEL_MEMBERSHIP",
  EXPORT_DATA: "EXPORT_DATA",
  MANAGE_STAFF: "MANAGE_STAFF",
  MANAGE_SETTINGS: "MANAGE_SETTINGS",
  MANAGE_PLANS: "MANAGE_PLANS",
  VIEW_AUDIT_LOGS: "VIEW_AUDIT_LOGS",
  MARK_ATTENDANCE_EXCEPTION: "MARK_ATTENDANCE_EXCEPTION",
  VOID_ATTENDANCE: "VOID_ATTENDANCE",
  ARCHIVE_MEMBER_WITH_DUES: "ARCHIVE_MEMBER_WITH_DUES",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

const OWNER_PERMISSIONS: Set<Permission> = new Set(Object.values(PERMISSIONS));

const STAFF_PERMISSIONS: Set<Permission> = new Set([
  // Staff has operational permissions: reception, check-in, standard renewals, recording payments
  // None of the owner-restricted permissions are in this set!
]);

export function hasPermission(role: UserRole, permission: Permission): boolean {
  if (role === USER_ROLES.OWNER) {
    return OWNER_PERMISSIONS.has(permission);
  }
  return STAFF_PERMISSIONS.has(permission);
}

export function assertPermission(role: UserRole, permission: Permission): void {
  if (!hasPermission(role, permission)) {
    throw new Error(`FORBIDDEN: Role '${role}' lacks permission '${permission}'`);
  }
}

