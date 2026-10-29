# Operational Runbook: Backups, Migrations, and Emergency Recovery

This runbook outlines operational procedures for system administrators and gym owners managing the IronPulse Gym web application.

---

## 1. Database Migrations Workflow

The application uses **Drizzle ORM** with versioned SQL migrations stored in the `drizzle/` directory.

### 1.1 Generating New Migrations
When changing `src/db/schema.ts`:
```bash
npm run db:generate
```
This inspects schema differences and generates a new timestamped SQL file in `drizzle/` (e.g. `0001_add_new_column.sql`) and updates `drizzle/meta/_journal.json`.

### 1.2 Applying Migrations
Apply pending migrations to the target Neon database:
```bash
npm run db:migrate
```
*Migrations execute inside transaction blocks. If any statement fails, the entire migration aborts and rolls back, leaving the database state intact.*

### 1.3 Safe Rollback Guidelines
1. Do not use destructive `DROP TABLE` or `DROP COLUMN` in production migrations without a 2-stage transition.
2. If a migration needs to be reverted:
   * Generate an inverse compensating migration (e.g., adding back dropped column or removing constraint).
   * Apply the new forward migration with `npm run db:migrate`.
   * For critical emergencies, restore the pre-migration snapshot using Neon Point-in-Time Recovery (Section 3).

---

## 2. Emergency Owner Recovery CLI

If the gym owner loses access to their account, forgets their password, or suspect account compromise, **never add a secret unauthenticated web reset endpoint**.

Use the documented offline administrative CLI tool:

### 2.1 Running Owner Recovery
Execute on a secure machine or terminal with database credentials:

```bash
# Display help and usage
npx tsx src/scripts/owner-recovery.ts --help

# Reset password for existing owner
npx tsx src/scripts/owner-recovery.ts --email "owner@ironpulse.in" --new-password "SecureOwnerNewPassword#2026"

# Or promote an existing active user to owner if owner was accidentally lost
npx tsx src/scripts/owner-recovery.ts --email "staff1@ironpulse.in" --make-owner
```

### 2.2 Security Guarantees of Owner Recovery CLI
* **Session Revocation:** Instantly revokes all active database sessions across all devices for that user.
* **Bcrypt Hashing:** Generates a fresh bcrypt salt and hash (cost factor 10); passwords are never stored in plaintext.
* **Audit Logging:** Inserts a permanent audit record into `audit_logs` capturing the recovery action, user ID, and timestamp.
* **Invariant Protection:** Refuses to de-escalate or deactivate the final remaining active owner in the system.

---

## 3. Database Backup, Restore, and Disaster Recovery

### 3.1 Point-in-Time Recovery (PITR) via Neon
If using **Neon Launch ($19/mo)**, Neon provides continuous write-ahead logging (WAL) with 7-day point-in-time recovery:
1. Open the [Neon Console](https://console.neon.tech).
2. Navigate to your project > **Branches**.
3. Click **Create Branch**.
4. Select **Point in Time** and specify the exact UTC minute prior to the incident or data loss.
5. Point your application's `DATABASE_URL` to the new branch to restore operations immediately.

### 3.2 Scheduled Logical Backups with `pg_dump`
Perform daily automated or manual logical exports:

#### Create Logical Backup:
```bash
# On Linux/macOS:
pg_dump --format=custom \
        --no-owner \
        --no-privileges \
        "$DATABASE_MIGRATION_URL" > "ironpulse_backup_$(date +%Y%m%d_%H%M%S).dump"

# On Windows PowerShell:
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
pg_dump --format=custom --no-owner --no-privileges $env:DATABASE_MIGRATION_URL > "ironpulse_backup_$timestamp.dump"
```

#### Test Restore from Backup:
To restore into an empty database or staging database:
```bash
pg_restore --clean \
           --if-exists \
           --no-owner \
           --no-privileges \
           -d "$STAGING_DATABASE_URL" \
           ironpulse_backup_20261029_180000.dump
```

*Always test restoring onto a temporary Neon branch monthly to verify backup file integrity.*

---

## 4. Staff Account Administration

### 4.1 Creating New Staff
1. Log in as `OWNER`.
2. Go to **Settings > Staff Accounts**.
3. Click **Add Staff Member**.
4. Provide Name, Phone, and unique Email.
5. A temporary, one-time setup credential is generated. Hand this credential securely to the staff member in person.
6. The staff member must sign in and change their password.

### 4.2 Deactivating Staff
1. Go to **Settings > Staff Accounts**.
2. Click **Deactivate** next to the employee's name.
3. **What happens immediately:**
   * Employee's `isActive` flag is set to `false`.
   * All current active sessions for that employee are revoked from the database.
   * Any subsequent request with their cookie is rejected with an HTTP 401 error.
   * Historical transactions (payments collected, attendance marked, follow-ups logged) **remain fully attributed to their name** in audit and financial reports.

---

## 5. Security Audit Log Inspection

IronPulse logs all critical security and financial actions in the `audit_logs` table.

### 5.1 Viewing Logs in the Web UI
* Navigate to **Settings > Audit Log** (accessible only by `OWNER`).
* Filter by:
  * User (Owner, Receptionist)
  * Action (`LOGIN_SUCCESS`, `LOGIN_FAILED`, `MEMBER_CREATE`, `PAYMENT_RECORD`, `REFUND_ISSUE`, `STAFF_DEACTIVATE`)
  * Date range

### 5.2 Direct Query for Suspicious Activity
To inspect failed login attempts in the database:
```sql
SELECT action, user_id, ip_address, created_at, details_json
FROM audit_logs
WHERE action = 'LOGIN_FAILED'
ORDER BY created_at DESC
LIMIT 50;
```
