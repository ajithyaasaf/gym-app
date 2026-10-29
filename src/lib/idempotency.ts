import crypto from "crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { idempotencyKeys } from "@/db/schema";

export function computePayloadHash(payload: unknown): string {
  const jsonStr = JSON.stringify(payload ?? {});
  return crypto.createHash("sha256").update(jsonStr).digest("hex");
}

export interface IdempotencyCheckResult<T> {
  isCached: boolean;
  data?: T;
  statusCode?: number;
}

/**
 * Execute an operation safely with idempotency guarantee.
 * - Same key + same payload => returns previous cached result.
 * - Same key + different payload => throws 409 Conflict.
 * - New key => executes operation, records response, returns result.
 */
export async function withIdempotency<T>(params: {
  key?: string | null;
  action: string;
  payload: unknown;
  handler: () => Promise<{ statusCode: number; data: T }>;
}): Promise<{ data: T; isCached: boolean; statusCode: number }> {
  const { key, action, payload, handler } = params;

  // If no idempotency key was supplied by client, generate a one-off or run directly
  if (!key || key.trim() === "") {
    const res = await handler();
    return { data: res.data, isCached: false, statusCode: res.statusCode };
  }

  const payloadHash = computePayloadHash(payload);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hour retention

  // Check existing key
  const existing = await db
    .select()
    .from(idempotencyKeys)
    .where(eq(idempotencyKeys.key, key))
    .limit(1);

  if (existing.length > 0) {
    const record = existing[0];
    if (record.payloadHash !== payloadHash) {
      throw new Error(
        "IDEMPOTENCY_CONFLICT: An operation with this idempotency key already exists with different payload parameters."
      );
    }

    if (record.responseJson) {
      return {
        isCached: true,
        statusCode: record.responseStatus ?? 200,
        data: JSON.parse(record.responseJson) as T,
      };
    }

    // In flight or incomplete
    throw new Error(
      "IDEMPOTENCY_IN_PROGRESS: This operation is currently in progress. Please retry in a few moments."
    );
  }

  // Insert key placeholder
  await db.insert(idempotencyKeys).values({
    key,
    action,
    payloadHash,
    createdAt: now,
    expiresAt,
  });

  try {
    const result = await handler();

    // Update with response
    await db
      .update(idempotencyKeys)
      .set({
        responseJson: JSON.stringify(result.data),
        responseStatus: result.statusCode,
      })
      .where(eq(idempotencyKeys.key, key));

    return {
      isCached: false,
      statusCode: result.statusCode,
      data: result.data,
    };
  } catch (err) {
    // On failure, delete the idempotency key so retry is permitted
    await db.delete(idempotencyKeys).where(eq(idempotencyKeys.key, key));
    throw err;
  }
}
