/**
 * GET /api/health — liveness probe. Healthy only when a query against the database succeeds.
 */

import { NextResponse } from "next/server";
import { checkDatabase } from "@/lib/ops/readiness";

export const dynamic = "force-dynamic";

export async function GET() {
  const startTime = Date.now();
  const database = await checkDatabase();
  return NextResponse.json(
    {
      status: database.ok ? "healthy" : "degraded",
      database: database.ok ? "connected" : "unreachable",
      responseTimeMs: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    },
    { status: database.ok ? 200 : 503, headers: { "Cache-Control": "no-store" } }
  );
}
