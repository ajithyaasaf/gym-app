import { NextRequest, NextResponse } from "next/server";
import { eq, and, sql, desc, gte, lte } from "drizzle-orm";
import { db } from "@/db";
import { expenses, expenseCategories, expenseTemplates, users } from "@/db/schema";
import { getCurrentSession } from "@/lib/auth";
import { recordExpense } from "@/server/services/expense-service";
import { USER_ROLES } from "@/lib/constants";
import { withIdempotency } from "@/lib/idempotency";

export async function GET(req: NextRequest) {
  try {
    const current = await getCurrentSession(req);
    if (!current) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Role check: Expenses are OWNER ONLY
    if (current.user.role !== USER_ROLES.OWNER) {
      return NextResponse.json(
        { error: "Forbidden: Only the owner has access to expenses." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const categoryId = searchParams.get("categoryId");

    const conditions = [];

    if (categoryId) {
      conditions.push(eq(expenses.categoryId, categoryId));
    }
    if (startDate) {
      conditions.push(gte(expenses.expenseDate, startDate));
    }
    if (endDate) {
      conditions.push(lte(expenses.expenseDate, endDate));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await db
      .select({
        id: expenses.id,
        expenseDate: expenses.expenseDate,
        title: expenses.title,
        payee: expenses.payee,
        amountPaise: expenses.amountPaise,
        paymentMethod: expenses.paymentMethod,
        referenceNumber: expenses.referenceNumber,
        notes: expenses.notes,
        isReversed: expenses.isReversed,
        reversalReason: expenses.reversalReason,
        categoryName: expenseCategories.name,
        recordedByName: users.name,
        createdAt: expenses.createdAt,
      })
      .from(expenses)
      .innerJoin(expenseCategories, eq(expenses.categoryId, expenseCategories.id))
      .innerJoin(users, eq(expenses.recordedByUserId, users.id))
      .where(whereClause)
      .orderBy(desc(expenses.expenseDate), desc(expenses.createdAt));

    // Also fetch categories and templates for expense logging
    const categoriesList = await db
      .select()
      .from(expenseCategories)
      .where(eq(expenseCategories.isActive, true));

    const templatesList = await db
      .select({
        id: expenseTemplates.id,
        categoryId: expenseTemplates.categoryId,
        categoryName: expenseCategories.name,
        title: expenseTemplates.title,
        amountPaise: expenseTemplates.amountPaise,
        defaultPaymentMethod: expenseTemplates.defaultPaymentMethod,
        payee: expenseTemplates.payee,
      })
      .from(expenseTemplates)
      .innerJoin(expenseCategories, eq(expenseTemplates.categoryId, expenseCategories.id))
      .where(eq(expenseTemplates.isActive, true));

    return NextResponse.json({
      expenses: rows,
      categories: categoriesList,
      templates: templatesList,
    });
  } catch (error) {
    console.error("GET /api/expenses error:", error);
    return NextResponse.json({ error: "Failed to fetch expenses" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const current = await getCurrentSession(req);
    if (!current) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (current.user.role !== USER_ROLES.OWNER) {
      return NextResponse.json(
        { error: "Forbidden: Only the owner can record expenses." },
        { status: 403 }
      );
    }

    const idempotencyKey = req.headers.get("x-idempotency-key");
    const body = await req.json();

    const result = await withIdempotency({
      key: idempotencyKey,
      action: "EXPENSE_RECORD",
      payload: body,
      handler: async () => {
        const res = await recordExpense({
          ...body,
          performedByUserId: current.user.id,
        });
        return { statusCode: 201, data: res };
      },
    });

    return NextResponse.json(result.data, { status: result.statusCode });
  } catch (error: any) {
    console.error("POST /api/expenses error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to record expense" },
      { status: 400 }
    );
  }
}

