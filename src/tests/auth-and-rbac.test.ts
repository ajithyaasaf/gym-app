import { describe, it, expect, beforeAll } from "vitest";
import { db } from "@/db";
import { users, sessions } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  hashPassword,
  verifyPassword,
  createSession,
  revokeSession,
  revokeAllUserSessions,
} from "@/lib/auth";
import { hasPermission, assertPermission, PERMISSIONS } from "@/lib/rbac";
import {
  createStaffAccount,
  deactivateStaffAccount,
  resetStaffPassword,
} from "@/server/services/staff-service";
import { USER_ROLES } from "@/lib/constants";
import crypto from "crypto";

describe("Authentication, Session Revocation, and Fixed Role-Based Access Control", () => {
  let ownerUser: { id: string; email: string };
  let staffUser: { id: string; email: string };

  beforeAll(async () => {
    // Look up bootstrapped owner
    const owners = await db
      .select()
      .from(users)
      .where(eq(users.role, USER_ROLES.OWNER))
      .limit(1);

    if (owners.length > 0) {
      ownerUser = { id: owners[0].id, email: owners[0].email };
    }

    // Look up staff
    const staffRows = await db
      .select()
      .from(users)
      .where(eq(users.role, USER_ROLES.STAFF))
      .limit(1);

    if (staffRows.length > 0) {
      staffUser = { id: staffRows[0].id, email: staffRows[0].email };
    }
  });

  it("Scenario 1: Password hashing and verification succeeds; invalid password fails verification", async () => {
    const rawPass = "Secret@Pass2026";
    const hashed = await hashPassword(rawPass);

    expect(await verifyPassword(rawPass, hashed)).toBe(true);
    expect(await verifyPassword("WrongPassword", hashed)).toBe(false);
  });

  it("Scenario 20: Role permissions matrix strictly enforces Owner vs Staff boundaries", () => {
    // Owner permissions
    expect(hasPermission(USER_ROLES.OWNER, PERMISSIONS.VIEW_FINANCIAL_REPORTS)).toBe(true);
    expect(hasPermission(USER_ROLES.OWNER, PERMISSIONS.VIEW_EXPENSES)).toBe(true);
    expect(hasPermission(USER_ROLES.OWNER, PERMISSIONS.MANAGE_EXPENSES)).toBe(true);
    expect(hasPermission(USER_ROLES.OWNER, PERMISSIONS.APPROVE_DISCOUNT)).toBe(true);
    expect(hasPermission(USER_ROLES.OWNER, PERMISSIONS.ISSUE_REFUND)).toBe(true);
    expect(hasPermission(USER_ROLES.OWNER, PERMISSIONS.EXPORT_DATA)).toBe(true);
    expect(hasPermission(USER_ROLES.OWNER, PERMISSIONS.MANAGE_STAFF)).toBe(true);

    // Staff MUST NOT have any of the owner financial or admin permissions
    expect(hasPermission(USER_ROLES.STAFF, PERMISSIONS.VIEW_FINANCIAL_REPORTS)).toBe(false);
    expect(hasPermission(USER_ROLES.STAFF, PERMISSIONS.VIEW_EXPENSES)).toBe(false);
    expect(hasPermission(USER_ROLES.STAFF, PERMISSIONS.MANAGE_EXPENSES)).toBe(false);
    expect(hasPermission(USER_ROLES.STAFF, PERMISSIONS.APPROVE_DISCOUNT)).toBe(false);
    expect(hasPermission(USER_ROLES.STAFF, PERMISSIONS.ISSUE_REFUND)).toBe(false);
    expect(hasPermission(USER_ROLES.STAFF, PERMISSIONS.EXPORT_DATA)).toBe(false);
    expect(hasPermission(USER_ROLES.STAFF, PERMISSIONS.MANAGE_STAFF)).toBe(false);

    // Asserting staff permission throws explicit forbidden error
    expect(() =>
      assertPermission(USER_ROLES.STAFF, PERMISSIONS.VIEW_FINANCIAL_REPORTS)
    ).toThrow(/FORBIDDEN: Role 'STAFF' lacks permission/);
  });

  it("Scenario 2: Deactivating staff revokes active sessions and blocks access; cannot deactivate last active owner", async () => {
    // 1. Create a temporary staff member
    const tempEmail = `temp.staff.${crypto.randomInt(1000, 9999)}@gym.in`;
    const created = await createStaffAccount({
      email: tempEmail,
      name: "Temporary Staff",
      role: USER_ROLES.STAFF,
      performedByUserId: ownerUser.id,
    });

    // 2. Create an active session for this staff
    const sessionId = await createSession({ userId: created.userId });
    const sessionInDb = await db
      .select()
      .from(sessions)
      .where(eq(sessions.id, sessionId));
    expect(sessionInDb.length).toBe(1);

    // 3. Deactivate the staff account
    await deactivateStaffAccount({
      targetUserId: created.userId,
      performedByUserId: ownerUser.id,
    });

    // Verify session was revoked in database
    const sessionAfterDeactivate = await db
      .select()
      .from(sessions)
      .where(eq(sessions.id, sessionId));
    expect(sessionAfterDeactivate.length).toBe(0); // Session deleted!

    // Verify user is inactive
    const userInDb = await db
      .select()
      .from(users)
      .where(eq(users.id, created.userId));
    expect(userInDb[0].isActive).toBe(false);

    // 4. Guard test: Attempting to deactivate the only active owner must be rejected!
    await expect(
      deactivateStaffAccount({
        targetUserId: ownerUser.id,
        performedByUserId: ownerUser.id,
      })
    ).rejects.toThrow(/Cannot deactivate the final active Owner/);
  });
});
