import { eq, and, sql, desc } from "drizzle-orm";
import { db } from "@/db";
import {
  expenses,
  expenseCategories,
  expenseTemplates,
} from "@/db/schema";
import { PaymentMethod } from "@/lib/constants";
import { logAuditEvent } from "@/lib/audit";
import { getTodayISTString } from "@/lib/dates";
import crypto from "crypto";

export interface RecordExpenseInput {
  categoryId: string;
  expenseDate: string; // 'YYYY-MM-DD'
  title: string;
  payee: string;
  amountPaise: number;
  paymentMethod: PaymentMethod;
  referenceNumber?: string | null;
  notes?: string | null;
  attachmentId?: string | null;
  performedByUserId: string;
}

export async function recordExpense(params: RecordExpenseInput) {
  if (params.amountPaise <= 0) {
    throw new Error("Expense amount must be greater than zero");
  }

  const expenseId = crypto.randomUUID();

  await db.insert(expenses).values({
    id: expenseId,
    categoryId: params.categoryId,
    expenseDate: params.expenseDate,
    title: params.title.trim(),
    payee: params.payee.trim(),
    amountPaise: params.amountPaise,
    paymentMethod: params.paymentMethod,
    referenceNumber: params.referenceNumber ? params.referenceNumber.trim() : null,
    notes: params.notes ? params.notes.trim() : null,
    attachmentId: params.attachmentId || null,
    recordedByUserId: params.performedByUserId,
  });

  await logAuditEvent({
    userId: params.performedByUserId,
    action: "EXPENSE_RECORD",
    entityType: "EXPENSE",
    entityId: expenseId,
    details: {
      title: params.title,
      amountPaise: params.amountPaise,
      category: params.categoryId,
    },
  });

  return { expenseId };
}

/**
 * Posts a recurring expense template for the current month:
 * Enforces one post per template per month (templateMonthKey: 'YYYY-MM')
 * to prevent accidental duplicate postings.
 */
export async function postRecurringExpenseTemplate(params: {
  templateId: string;
  expenseDate?: string;
  monthKey?: string; // 'YYYY-MM'
  performedByUserId: string;
}) {
  const today = getTodayISTString();
  const dateStr = params.expenseDate || today;
  const monthKey = params.monthKey || dateStr.slice(0, 7); // 'YYYY-MM'

  return db.transaction(async (tx) => {
    // 1. Fetch template
    const templateRows = await tx
      .select()
      .from(expenseTemplates)
      .where(eq(expenseTemplates.id, params.templateId))
      .limit(1);

    if (templateRows.length === 0) {
      throw new Error("Expense template not found");
    }
    const template = templateRows[0];

    // 2. Check if already posted for this month
    const existing = await tx
      .select()
      .from(expenses)
      .where(
        and(
          eq(expenses.expenseTemplateId, params.templateId),
          eq(expenses.templateMonthKey, monthKey),
          eq(expenses.isReversed, false)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      throw new Error(
        `This recurring expense (${template.title}) has already been recorded for month ${monthKey}. Duplicate monthly posting is prevented.`
      );
    }

    const expenseId = crypto.randomUUID();

    await tx.insert(expenses).values({
      id: expenseId,
      categoryId: template.categoryId,
      expenseTemplateId: template.id,
      templateMonthKey: monthKey,
      expenseDate: dateStr,
      title: `${template.title} (${monthKey})`,
      payee: template.payee,
      amountPaise: template.amountPaise,
      paymentMethod: template.defaultPaymentMethod as PaymentMethod,
      recordedByUserId: params.performedByUserId,
    });

    await logAuditEvent({
      userId: params.performedByUserId,
      action: "EXPENSE_RECORD_RECURRING",
      entityType: "EXPENSE",
      entityId: expenseId,
      details: {
        templateId: template.id,
        monthKey,
        amountPaise: template.amountPaise,
      },
      tx,
    });

    return {
      expenseId,
      templateMonthKey: monthKey,
    };
  });
}

/**
 * Reverses an erroneous expense (Owner only).
 */
export async function reverseExpense(params: {
  expenseId: string;
  reversalReason: string;
  ownerUserId: string;
}) {
  return db.transaction(async (tx) => {
    const existing = await tx
      .select()
      .from(expenses)
      .where(eq(expenses.id, params.expenseId))
      .limit(1);

    if (existing.length === 0) {
      throw new Error("Expense not found");
    }

    if (existing[0].isReversed) {
      throw new Error("Expense has already been reversed");
    }

    await tx
      .update(expenses)
      .set({
        isReversed: true,
        reversedAt: new Date(),
        reversalReason: params.reversalReason,
      })
      .where(eq(expenses.id, params.expenseId));

    await logAuditEvent({
      userId: params.ownerUserId,
      action: "EXPENSE_REVERSE",
      entityType: "EXPENSE",
      entityId: params.expenseId,
      reason: params.reversalReason,
      tx,
    });
  });
}

