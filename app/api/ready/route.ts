/**
 * GET /api/ready — readiness probe: database reachable and migrated, evidence storage writable,
 * production configuration present.
 */

import { NextResponse } from "next/server";
import { runReadinessChecks } from "@/lib/ops/readiness";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = await runReadinessChecks();
  return NextResponse.json(
    { status: result.ready ? "ready" : "not_ready", checks: result.checks, timestamp: new Date().toISOString() },
    { status: result.ready ? 200 : 503, headers: { "Cache-Control": "no-store" } }
  );
}
