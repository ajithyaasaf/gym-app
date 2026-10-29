import { eq } from "drizzle-orm";
import { db, pool } from "@/db";
import { users, gymSettings, expenseCategories } from "@/db/schema";
import { hashPassword } from "@/lib/auth";
import { USER_ROLES } from "@/lib/constants";
import crypto from "crypto";
import * as dotenv from "dotenv";

dotenv.config();

async function bootstrapOwner() {
  console.log("=== Gym Management App: Owner Bootstrap Tool ===");

  const email = process.env.INITIAL_OWNER_EMAIL || "owner@ironpulse.in";
  const name = process.env.INITIAL_OWNER_NAME || "Gym Owner";
  const password = process.env.INITIAL_OWNER_PASSWORD || "IronPulse@2026";

  // Check if any owner already exists
  const existingOwners = await db
    .select()
    .from(users)
    .where(eq(users.role, USER_ROLES.OWNER))
    .limit(1);

  if (existingOwners.length > 0) {
    console.log(`[INFO] An Owner account already exists: ${existingOwners[0].email} (${existingOwners[0].name}).`);
    console.log("Bootstrap aborted to protect existing accounts. Use 'npm run auth:recovery' if password reset is required.");
    await pool.end();
    return;
  }

  const passwordHash = await hashPassword(password);
  const ownerId = crypto.randomUUID();

  // Create Owner
  await db.insert(users).values({
    id: ownerId,
    email: email.toLowerCase().trim(),
    name,
    role: USER_ROLES.OWNER,
    passwordHash,
    isActive: true,
    mustChangePassword: false,
  });

  // Ensure default gym settings exist
  await db
    .insert(gymSettings)
    .values({
      id: "default",
      gymName: "IronPulse Fitness Club",
      phone: "+91 98765 43210",
      email: "contact@ironpulse.in",
      address: "123 MG Road, Indiranagar, Bengaluru, Karnataka 560001",
      receiptPrefix: "REC",
      timezone: "Asia/Kolkata",
      absenceThresholdDays: 10,
    })
    .onConflictDoNothing();

  // Ensure standard expense categories exist
  const defaultCategories = [
    { id: "cat_rent", name: "Facility Rent", description: "Monthly gym floor and building lease" },
    { id: "cat_salaries", name: "Staff Salaries", description: "Trainer and staff payroll" },
    { id: "cat_electricity", name: "Electricity & Utilities", description: "Power, AC, and water bills" },
    { id: "cat_maintenance", name: "Equipment Maintenance", description: "Machine repairs and servicing" },
    { id: "cat_supplies", name: "Supplies & Cleaning", description: "Sanitation, towels, and office supplies" },
    { id: "cat_other", name: "Other Operational", description: "Miscellaneous expenses" },
  ];

  for (const cat of defaultCategories) {
    await db.insert(expenseCategories).values(cat).onConflictDoNothing();
  }

  console.log(`[SUCCESS] Initial Owner account created successfully!`);
  console.log(`Email:    ${email}`);
  console.log(`Role:     OWNER`);
  console.log(`Note: Change your password upon initial sign-in.`);
  await pool.end();
}

bootstrapOwner().catch(async (err) => {
  console.error("[ERROR] Bootstrap failed:", err);
  await pool.end();
  process.exit(1);
});
