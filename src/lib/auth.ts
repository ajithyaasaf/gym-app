import { cookies } from "next/headers";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { eq, and, gt } from "drizzle-orm";
import { db } from "@/db";
import { users, sessions, auditLogs } from "@/db/schema";
import { USER_ROLES, type UserRole } from "./constants";

export const SESSION_COOKIE_NAME = "gym_session_token";
const SESSION_TTL_DAYS = 7;

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  isActive: boolean;
  mustChangePassword: boolean;
}

export interface CurrentSession {
  session: {
    id: string;
    expiresAt: Date;
  };
  user: SessionUser;
}

/**
 * Hash password with bcrypt.
 */
export async function hashPassword(plaintext: string): Promise<string> {
  const salt = await bcrypt.genSalt(12);
  return bcrypt.hash(plaintext, salt);
}

/**
 * Verify password against hash.
 */
export async function verifyPassword(
  plaintext: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(plaintext, hash);
}

/**
 * Create a new database-backed session for a user and return the session ID.
 */
export async function createSession(params: {
  userId: string;
  ipAddress?: string;
  userAgent?: string;
}): Promise<string> {
  const sessionId = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);

  await db.insert(sessions).values({
    id: sessionId,
    userId: params.userId,
    expiresAt,
    ipAddress: params.ipAddress || null,
    userAgent: params.userAgent || null,
  });

  return sessionId;
}

/**
 * Set session cookie in Next.js headers.
 */
export async function setSessionCookie(sessionId: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_DAYS * 24 * 60 * 60,
  });
}

/**
 * Delete session cookie.
 */
export async function deleteSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

/**
 * Get current session from cookie or request, validate from DB, check expiry and user active state.
 */
export async function getCurrentSession(
  tokenOrReq?: string | { cookies?: { get: (name: string) => { value?: string } | undefined }; headers?: Headers }
): Promise<CurrentSession | null> {
  try {
    let token: string | undefined;

    if (typeof tokenOrReq === "string") {
      token = tokenOrReq;
    } else if (tokenOrReq) {
      if (tokenOrReq.cookies && typeof tokenOrReq.cookies.get === "function") {
        token = tokenOrReq.cookies.get(SESSION_COOKIE_NAME)?.value;
      }
      if (!token && tokenOrReq.headers && typeof tokenOrReq.headers.get === "function") {
        const cookieHeader = tokenOrReq.headers.get("cookie");
        if (cookieHeader) {
          const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE_NAME}=([^;]+)`));
          if (match) token = decodeURIComponent(match[1]);
        }
      }
    }

    if (!token) {
      try {
        const cookieStore = await cookies();
        token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
      } catch {
        // Ignored if outside request store
      }
    }

    if (!token) return null;

    const result = await db
      .select({
        sessionId: sessions.id,
        expiresAt: sessions.expiresAt,
        userId: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        isActive: users.isActive,
        mustChangePassword: users.mustChangePassword,
      })
      .from(sessions)
      .innerJoin(users, eq(sessions.userId, users.id))
      .where(
        and(
          eq(sessions.id, token),
          gt(sessions.expiresAt, new Date())
        )
      )
      .limit(1);

    if (result.length === 0) {
      return null;
    }

    const row = result[0];

    // If user has been deactivated, revoke session immediately
    if (!row.isActive) {
      await revokeSession(token);
      return null;
    }

    return {
      session: {
        id: row.sessionId,
        expiresAt: row.expiresAt,
      },
      user: {
        id: row.userId,
        email: row.email,
        name: row.name,
        role: row.role as UserRole,
        isActive: row.isActive,
        mustChangePassword: row.mustChangePassword,
      },
    };
  } catch (error) {
    console.error("getCurrentSession error:", error);
    return null;
  }
}

/**
 * Revoke a single session.
 */
export async function revokeSession(sessionId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.id, sessionId));
}

/**
 * Revoke all sessions for a user (e.g. on deactivation or password change).
 */
export async function revokeAllUserSessions(userId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.userId, userId));
}

/**
 * Ensure user is logged in. Throws error or redirects.
 */
export async function requireAuth(
  tokenOrReq?: string | { cookies?: { get: (name: string) => { value?: string } | undefined }; headers?: Headers }
): Promise<CurrentSession> {
  const current = await getCurrentSession(tokenOrReq);
  if (!current) {
    throw new Error("UNAUTHORIZED");
  }
  return current;
}

/**
 * Ensure user has specific role (e.g. OWNER).
 */
export async function requireOwner(
  tokenOrReq?: string | { cookies?: { get: (name: string) => { value?: string } | undefined }; headers?: Headers }
): Promise<CurrentSession> {
  const current = await requireAuth(tokenOrReq);
  if (current.user.role !== USER_ROLES.OWNER) {
    throw new Error("FORBIDDEN: Owner permission required");
  }
  return current;
}

