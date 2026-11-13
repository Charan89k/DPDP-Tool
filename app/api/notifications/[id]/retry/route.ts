import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { retryNotification } from "@/lib/notifications/dispatch";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** TLI lead consultants and the super administrator retry a failed email. */
export async function POST(_req: NextRequest, { params }: RouteParams) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  try {
    return NextResponse.json(await retryNotification(session, id));
  } catch (err) {
    const code = err instanceof Error ? err.message : "";
    if (code === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (code === "NOT_FOUND") return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (code === "NOT_FAILED") return NextResponse.json({ error: "Only failed emails can be retried." }, { status: 409 });
    console.error("Notification retry failed:", code);
    return NextResponse.json({ error: "Retry failed. Please try again." }, { status: 500 });
  }
}
