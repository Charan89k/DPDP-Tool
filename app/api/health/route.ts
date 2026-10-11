/**
 * TLI DPDP Compliance Gap Analysis Tool — System Health Endpoint
 *
 * GET /api/health
 * Verifies system readiness and database connectivity.
 * Redacts internal hostnames, credentials, and topology details.
 */

import { NextResponse } from "next/server";
import { pool } from "@/lib/db/pool";

export async function GET() {
  try {
    const startTime = Date.now();
    await pool.query("SELECT 1;");
    const responseTimeMs = Date.now() - startTime;

    return NextResponse.json(
      {
        status: "healthy",
        database: "connected",
        responseTimeMs,
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("Health check database probe failed:", err instanceof Error ? err.message : "Unknown error");

    return NextResponse.json(
      {
        status: "degraded",
        database: "unreachable",
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}

