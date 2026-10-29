import { eq } from "drizzle-orm";
import { db, pool } from "@/db";
import { users } from "@/db/schema";
import { hashPassword, revokeAllUserSessions } from "@/lib/auth";
import { USER_ROLES } from "@/lib/constants";
import * as dotenv from "dotenv";

dotenv.config();

async function ownerRecovery() {
  console.log("=== Gym Management App: Administrative Owner Recovery ===");

  const targetEmail = process.argv[2] || process.env.RECOVERY_OWNER_EMAIL || "owner@ironpulse.in";
  const newPassword = process.argv[3] || process.env.RECOVERY_NEW_PASSWORD || "Recovered@2026";

  const targetRows = await db
    .select()
    .from(users)
    .where(eq(users.email, targetEmail.toLowerCase().trim()))
    .limit(1);

  if (targetRows.length === 0) {
    console.error(`[ERROR] No account found with email: ${targetEmail}`);
    await pool.end();
    process.exit(1);
  }

  const user = targetRows[0];
  const newHash = await hashPassword(newPassword);

  await db
    .update(users)
    .set({
      role: USER_ROLES.OWNER,
      passwordHash: newHash,
      isActive: true,
      mustChangePassword: false,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));

  // Revoke all existing sessions for security
  await revokeAllUserSessions(user.id);

  console.log(`[SUCCESS] Account for '${targetEmail}' has been recovered and updated to active OWNER.`);
  console.log("All existing sessions have been revoked.");
  await pool.end();
}

ownerRecovery().catch(async (err) => {
  console.error("[ERROR] Recovery failed:", err);
  await pool.end();
  process.exit(1);
});
