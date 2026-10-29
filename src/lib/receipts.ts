import { sql } from "drizzle-orm";
import { db } from "@/db";
import { receiptSequence, gymSettings } from "@/db/schema";
import { getTodayISTString } from "./dates";

/**
 * Atomically generates the next unique receipt number under concurrency.
 * Format: REC-YYYY-00001 (or custom gym prefix)
 */
export async function getNextReceiptNumber(tx?: Parameters<Parameters<typeof db.transaction>[0]>[0]): Promise<{
  receiptNumber: string;
  sequenceNumber: number;
}> {
  const currentDb = tx || db;
  const currentYear = Number(getTodayISTString().split("-")[0]);

  // Ensure sequence row exists
  await currentDb.execute(sql`
    INSERT INTO receipt_sequence (id, current_number, year)
    VALUES ('receipt_seq', 0, ${currentYear})
    ON CONFLICT (id) DO NOTHING
  `);

  // Atomically increment and return new sequence number using row-level locking
  const result = await currentDb.execute(sql`
    UPDATE receipt_sequence
    SET current_number = current_number + 1
    WHERE id = 'receipt_seq'
    RETURNING current_number, year
  `);

  const row = result.rows[0] as { current_number: number; year: number };
  const seqNum = Number(row.current_number);

  // Fetch configured gym receipt prefix
  const settingsRows = await currentDb.execute(sql`
    SELECT receipt_prefix FROM gym_settings WHERE id = 'default' LIMIT 1
  `);
  const prefix = (settingsRows.rows[0] as { receipt_prefix?: string })?.receipt_prefix || "REC";

  const paddedSeq = String(seqNum).padStart(5, "0");
  const receiptNumber = `${prefix}-${row.year}-${paddedSeq}`;

  return {
    receiptNumber,
    sequenceNumber: seqNum,
  };
}
