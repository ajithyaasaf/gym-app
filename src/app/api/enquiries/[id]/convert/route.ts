import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { convertEnquiryToMember } from "@/server/services/enquiry-service";
import { withIdempotency } from "@/lib/idempotency";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const current = await getCurrentSession();
    if (!current) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const idempotencyKey = req.headers.get("x-idempotency-key");

    const result = await withIdempotency({
      key: idempotencyKey,
      action: "ENQUIRY_CONVERT",
      payload: { enquiryId: id, ...body },
      handler: async () => {
        const res = await convertEnquiryToMember({
          enquiryId: id,
          enrollment: body.enrollment,
          email: body.email,
          address: body.address,
          emergencyContactName: body.emergencyContactName,
          emergencyContactPhone: body.emergencyContactPhone,
          sharedPhoneAcknowledged: body.sharedPhoneAcknowledged,
          performedByUserId: current.user.id,
        });
        return { statusCode: 201, data: res };
      },
    });

    return NextResponse.json(result.data, { status: result.statusCode });
  } catch (error: any) {
    console.error("POST /api/enquiries/[id]/convert error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to convert enquiry" },
      { status: 400 }
    );
  }
}

