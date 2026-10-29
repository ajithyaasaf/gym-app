import { NextRequest, NextResponse } from "next/server";
import { eq, and, sql, or, ilike, desc } from "drizzle-orm";
import { db } from "@/db";
import { members, membershipTerms, charges } from "@/db/schema";
import { getCurrentSession } from "@/lib/auth";
import { createMember } from "@/server/services/member-service";
import { withIdempotency } from "@/lib/idempotency";
import { getTodayISTString } from "@/lib/dates";

export async function GET(req: NextRequest) {
  try {
    const current = await getCurrentSession();
    if (!current) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.trim() || "";
    const status = searchParams.get("status")?.trim();
    const page = Math.max(1, Number(searchParams.get("page") || 1));
    const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit") || 20)));
    const offset = (page - 1) * limit;

    const today = getTodayISTString();

    // Query builder
    let query = db
      .select({
        id: members.id,
        memberCode: members.memberCode,
        name: members.name,
        phone: members.phone,
        email: members.email,
        isArchived: members.isArchived,
        createdAt: members.createdAt,
      })
      .from(members);

    const conditions = [];

    // Filter by search string
    if (search) {
      conditions.push(
        or(
          ilike(members.name, `%${search}%`),
          ilike(members.phone, `%${search}%`),
          ilike(members.memberCode, `%${search}%`)
        )
      );
    }

    // Archived filter
    if (status === "ARCHIVED") {
      conditions.push(eq(members.isArchived, true));
    } else {
      conditions.push(eq(members.isArchived, false));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Total count query
    const countResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(members)
      .where(whereClause);
    const totalCount = countResult[0]?.count || 0;

    // Data query with pagination
    const rows = await db
      .select({
        id: members.id,
        memberCode: members.memberCode,
        name: members.name,
        phone: members.phone,
        email: members.email,
        isArchived: members.isArchived,
        createdAt: members.createdAt,
      })
      .from(members)
      .where(whereClause)
      .orderBy(desc(members.createdAt))
      .limit(limit)
      .offset(offset);

    // Fetch active term and outstanding balance for each returned member in this page
    const memberIds = rows.map((r) => r.id);

    const enriched = await Promise.all(
      rows.map(async (m) => {
        // Fetch latest non-cancelled term
        const terms = await db
          .select({
            status: membershipTerms.status,
            validThrough: membershipTerms.validThrough,
            planName: membershipTerms.planNameSnapshot,
          })
          .from(membershipTerms)
          .where(
            and(
              eq(membershipTerms.memberId, m.id),
              sql`${membershipTerms.status} != 'CANCELLED'`
            )
          )
          .orderBy(desc(membershipTerms.endDate))
          .limit(1);

        // Fetch balance due
        const dues = await db.execute(
          sql`SELECT COALESCE(SUM(balance_paise), 0) as due FROM charges WHERE member_id = ${m.id} AND status != 'CANCELLED'`
        );
        const balancePaise = Number((dues.rows[0] as { due: number })?.due || 0);

        return {
          ...m,
          latestTerm: terms[0] || null,
          balancePaise,
        };
      })
    );

    return NextResponse.json({
      members: enriched,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    console.error("GET /api/members error:", error);
    return NextResponse.json({ error: "Failed to fetch members" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const current = await getCurrentSession();
    if (!current) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const idempotencyKey = req.headers.get("x-idempotency-key");
    const body = await req.json();

    const result = await withIdempotency({
      key: idempotencyKey,
      action: "MEMBER_CREATE",
      payload: body,
      handler: async () => {
        const res = await createMember({
          ...body,
          performedByUserId: current.user.id,
        });
        return { statusCode: 201, data: res };
      },
    });

    return NextResponse.json(result.data, { status: result.statusCode });
  } catch (error: any) {
    console.error("POST /api/members error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create member" },
      { status: 400 }
    );
  }
}
