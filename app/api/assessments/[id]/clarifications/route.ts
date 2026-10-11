/**
 * TLI DPDP Compliance Gap Analysis Tool — Clarifications Management API
 *
 * POST /api/assessments/[id]/clarifications
 * Manages question-level clarification threads and threaded messages:
 * - Create new clarification thread for a specific question code
 * - Append message to an existing clarification thread
 * - Resolve or reopen a clarification thread
 * Enforces PostgreSQL RLS: Only authorized assessors and client tenant members can participate.
 */

import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { executeWithRls } from "@/lib/db/rls";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
  const sessionUser = await getCurrentSession();
  const { id: assessmentId } = await params;

  if (!sessionUser) {
    return NextResponse.json(
      { error: "Authentication required to participate in clarification threads." },
      { status: 401 }
    );
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const { threadId, questionCode, title, message, status } = body;

  try {
    const result = await executeWithRls(sessionUser, async (client) => {
      // 1. Verify assessment exists and user has access under RLS
      const assessRes = await client.query(
        "SELECT id, status FROM assessments WHERE id = $1 LIMIT 1;",
        [assessmentId]
      );
      if (assessRes.rowCount === 0) {
        throw new Error("ASSESSMENT_NOT_FOUND_OR_FORBIDDEN");
      }

      // Case A: Reply to existing thread
      if (threadId && message) {
        const trimmedMessage = String(message).trim();
        if (!trimmedMessage) {
          throw new Error("Message text cannot be empty.");
        }

        const msgRes = await client.query(
          `INSERT INTO clarification_messages (
            thread_id,
            author_user_id,
            message_text
          ) VALUES ($1, $2, $3)
          RETURNING id, created_at;`,
          [threadId, sessionUser.userId, trimmedMessage]
        );

        return {
          action: "REPLY_POSTED",
          messageId: msgRes.rows[0].id,
          createdAt: msgRes.rows[0].created_at,
        };
      }

      // Case B: Status toggle (RESOLVED / OPEN)
      if (threadId && status) {
        if (!["OPEN", "RESOLVED"].includes(status)) {
          throw new Error("Status must be either 'OPEN' or 'RESOLVED'.");
        }

        await client.query(
          `UPDATE clarification_threads
           SET status = $1,
               resolved_at = CASE WHEN $1 = 'RESOLVED' THEN CURRENT_TIMESTAMP ELSE NULL END
           WHERE id = $2;`,
          [status, threadId]
        );

        return {
          action: "STATUS_UPDATED",
          threadId,
          status,
        };
      }

      // Case C: Create new clarification thread
      if (questionCode && title && message) {
        const trimmedTitle = String(title).trim();
        const trimmedMessage = String(message).trim();

        if (!trimmedTitle || !trimmedMessage) {
          throw new Error("Title and message cannot be empty.");
        }

        const threadRes = await client.query(
          `INSERT INTO clarification_threads (
            assessment_id,
            question_code,
            raised_by_user_id,
            title,
            status
          ) VALUES ($1, $2, $3, $4, 'OPEN')
          RETURNING id, created_at;`,
          [assessmentId, questionCode, sessionUser.userId, trimmedTitle]
        );

        const newThreadId = threadRes.rows[0].id;

        await client.query(
          `INSERT INTO clarification_messages (
            thread_id,
            author_user_id,
            message_text
          ) VALUES ($1, $2, $3);`,
          [newThreadId, sessionUser.userId, trimmedMessage]
        );

        return {
          action: "THREAD_CREATED",
          threadId: newThreadId,
          questionCode,
          title: trimmedTitle,
        };
      }

      throw new Error("Invalid clarification payload. Provide either (questionCode, title, message) or (threadId, message).");
    });

    return NextResponse.json({
      success: true,
      assessmentId,
      ...result,
    });
  } catch (err: any) {
    if (err.message === "ASSESSMENT_NOT_FOUND_OR_FORBIDDEN") {
      return NextResponse.json(
        { error: "Assessment not found or access denied." },
        { status: 404 }
      );
    }
    console.error("Failed to process clarification:", err);
    return NextResponse.json(
      { error: err.message || "Failed to process clarification under security boundary." },
      { status: 500 }
    );
  }
}

