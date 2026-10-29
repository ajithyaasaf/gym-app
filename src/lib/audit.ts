import { db } from "@/db";
import { auditLogs } from "@/db/schema";
import crypto from "crypto";

export async function logAuditEvent(params: {
  userId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  reason?: string | null;
  details?: Record<string, unknown> | null;
  ipAddress?: string | null;
  tx?: Parameters<Parameters<typeof db.transaction>[0]>[0];
}): Promise<void> {
  const currentDb = params.tx || db;

  // Filter out any sensitive keys from details
  let sanitizedDetails = params.details;
  if (sanitizedDetails) {
    const copy = { ...sanitizedDetails };
    delete copy.password;
    delete copy.passwordHash;
    delete copy.tempPassword;
    delete copy.sessionToken;
    sanitizedDetails = copy;
  }

  await currentDb.insert(auditLogs).values({
    id: crypto.randomUUID(),
    userId: params.userId || null,
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId,
    reason: params.reason || null,
    detailsJson: sanitizedDetails ? JSON.stringify(sanitizedDetails) : null,
    ipAddress: params.ipAddress || null,
  });
}
