import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession, revokeSession, deleteSessionCookie } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const current = await getCurrentSession();
    if (current) {
      await revokeSession(current.session.id);
    }
    await deleteSessionCookie();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Logout API error:", error);
    await deleteSessionCookie();
    return NextResponse.json({ success: true });
  }
}
