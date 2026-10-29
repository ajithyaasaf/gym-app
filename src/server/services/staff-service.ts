import { eq, and, sql } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { hashPassword, revokeAllUserSessions } from "@/lib/auth";
import { USER_ROLES, type UserRole } from "@/lib/constants";
import { logAuditEvent } from "@/lib/audit";
import crypto from "crypto";

export interface CreateStaffInput {
  name: string;
  email: string;
  role: UserRole;
  tempPassword?: string;
  performedByUserId: string;
}

/**
 * Creates a new staff or owner account.
 * Requires one-time setup password with mustChangePassword flag.
 */
export async function createStaffAccount(params: CreateStaffInput) {
  const trimmedEmail = params.email.trim().toLowerCase();
  const trimmedName = params.name.trim();

  // Generate temporary password if not provided
  const tempPassword = params.tempPassword || crypto.randomBytes(6).toString("base64").slice(0, 8);
  const passwordHash = await hashPassword(tempPassword);

  const userId = crypto.randomUUID();
  const tempPasswordExpiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours

  await db.insert(users).values({
    id: userId,
    email: trimmedEmail,
    name: trimmedName,
    role: params.role,
    passwordHash,
    isActive: true,
    mustChangePassword: true,
    tempPasswordExpiresAt,
  });

  await logAuditEvent({
    userId: params.performedByUserId,
    action: "USER_CREATE",
    entityType: "USER",
    entityId: userId,
    details: {
      email: trimmedEmail,
      role: params.role,
    },
  });

  return {
    userId,
    email: trimmedEmail,
    tempPassword,
    expiresAt: tempPasswordExpiresAt,
  };
}

/**
 * Deactivates a staff account.
 * Guard: Prevents disabling or demoting the final active owner!
 * Revokes all active sessions for the deactivated user.
 */
export async function deactivateStaffAccount(params: {
  targetUserId: string;
  performedByUserId: string;
}) {
  return db.transaction(async (tx) => {
    const targetRows = await tx
      .select()
      .from(users)
      .where(eq(users.id, params.targetUserId))
      .limit(1);

    if (targetRows.length === 0) {
      throw new Error("User not found");
    }
    const target = targetRows[0];

    // If target is an owner, verify there is at least one other active owner
    if (target.role === USER_ROLES.OWNER) {
      const activeOwners = await tx
        .select({ id: users.id })
        .from(users)
        .where(
          and(
            eq(users.role, USER_ROLES.OWNER),
            eq(users.isActive, true),
            sql`${users.id} != ${target.id}`
          )
        );

      if (activeOwners.length === 0) {
        throw new Error(
          "ACTION_BLOCKED: Cannot deactivate the final active Owner of the gym."
        );
      }
    }

    await tx
      .update(users)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(eq(users.id, params.targetUserId));

    // Revoke all active sessions
    await revokeAllUserSessions(params.targetUserId);

    await logAuditEvent({
      userId: params.performedByUserId,
      action: "USER_DEACTIVATE",
      entityType: "USER",
      entityId: params.targetUserId,
      tx,
    });
  });
}

/**
 * Owner-operated reset of staff password:
 * Sets a new temporary password, marks mustChangePassword: true,
 * and revokes existing sessions.
 */
export async function resetStaffPassword(params: {
  targetUserId: string;
  performedByUserId: string;
}) {
  const tempPassword = crypto.randomBytes(6).toString("base64").slice(0, 8);
  const passwordHash = await hashPassword(tempPassword);
  const tempPasswordExpiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

  await db
    .update(users)
    .set({
      passwordHash,
      mustChangePassword: true,
      tempPasswordExpiresAt,
      updatedAt: new Date(),
    })
    .where(eq(users.id, params.targetUserId));

  await revokeAllUserSessions(params.targetUserId);

  await logAuditEvent({
    userId: params.performedByUserId,
    action: "USER_PASSWORD_RESET_BY_OWNER",
    entityType: "USER",
    entityId: params.targetUserId,
  });

  return { tempPassword, expiresAt: tempPasswordExpiresAt };
}
