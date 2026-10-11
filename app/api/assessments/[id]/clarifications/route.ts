/**
 * TLI DPDP Compliance Gap Analysis Tool — Clarifications Management API
 *
 * GET /api/assessments/[id]/clarifications
 * - Retrieves all clarification threads and threaded messages for an assessment under RLS.
 *
 * POST /api/assessments/[id]/clarifications
 * Manages question-level and evidence-item-level clarification threads:
 * - Create new clarification thread for a specific question code or evidence item
 * - Append message to an existing clarification thread
 * - Update thread status (OPEN, IN_PROGRESS, REQUIRES_FURTHER_INFO, RESOLVED)
 * Enforces PostgreSQL RLS: Only authorized assessors and client tenant members can participate.
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { executeWithRls } from "@/lib/db/rls";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const sessionUser = await getCurrentSession();
  const { id: assessmentId } = await params;

  if (!sessionUser) {
    return NextResponse.json(
      { error: "Authentication required to view clarification threads." },
      { status: 401 }
    );
  }

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

      // 2. Fetch threads
      const threadsRes = await client.query(
        `SELECT 
          ct.id,
          ct.assessment_id,
          ct.question_code,
          ct.evidence_item_id,
          ct.target_role,
          ct.title,
          ct.status,
          ct.raised_by_user_id,
          u.full_name AS raised_by_name,
          ct.created_at,
          ct.resolved_at,
          ei.file_name AS evidence_file_name,
          ei.status AS evidence_status
        FROM clarification_threads ct
        LEFT JOIN users u ON u.id = ct.raised_by_user_id
        LEFT JOIN evidence_items ei ON ei.id = ct.evidence_item_id
        WHERE ct.assessment_id = $1
        ORDER BY ct.created_at DESC;`,
        [assessmentId]
      );

      const threadIds = threadsRes.rows.map((r) => r.id);
      let messagesMap = new Map<string, any[]>();

      if (threadIds.length > 0) {
        const msgsRes = await client.query(
          `SELECT 
            cm.id,
            cm.thread_id,
            cm.author_user_id,
            mu.full_name AS author_name,
            cm.message_text,
            cm.created_at
          FROM clarification_messages cm
          LEFT JOIN users mu ON mu.id = cm.author_user_id
          WHERE cm.thread_id = ANY($1::uuid[])
          ORDER BY cm.created_at ASC;`,
          [threadIds]
        );

        for (const msg of msgsRes.rows) {
          const list = messagesMap.get(msg.thread_id) || [];
          list.push({
            id: msg.id,
            threadId: msg.thread_id,
            authorUserId: msg.author_user_id,
            authorName: msg.author_name || "Authorized User",
            messageText: msg.message_text,
            createdAt: msg.created_at ? msg.created_at.toISOString() : null,
          });
          messagesMap.set(msg.thread_id, list);
        }
      }

      const threads = threadsRes.rows.map((row) => ({
        id: row.id,
        assessmentId: row.assessment_id,
        questionCode: row.question_code,
        evidenceItemId: row.evidence_item_id,
        evidenceFileName: row.evidence_file_name,
        evidenceStatus: row.evidence_status,
        targetRole: row.target_role,
        title: row.title,
        status: row.status,
        raisedByUserId: row.raised_by_user_id,
        raisedByName: row.raised_by_name || "Assessor",
        createdAt: row.created_at ? row.created_at.toISOString() : null,
        resolvedAt: row.resolved_at ? row.resolved_at.toISOString() : null,
        messages: messagesMap.get(row.id) || [],
      }));

      return threads;
    });

    return NextResponse.json({
      success: true,
      assessmentId,
      threads: result,
    });
  } catch (err: any) {
    if (err.message === "ASSESSMENT_NOT_FOUND_OR_FORBIDDEN") {
      return NextResponse.json(
        { error: "Assessment not found or access denied." },
        { status: 404 }
      );
    }
    console.error("Failed to fetch clarifications:", err);
    return NextResponse.json(
      { error: err.message || "Failed to retrieve clarification threads." },
      { status: 500 }
    );
  }
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

  const { threadId, questionCode, evidenceItemId, targetRole, title, message, status } = body;

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

      // Case B: Status update (OPEN, IN_PROGRESS, REQUIRES_FURTHER_INFO, RESOLVED)
      if (threadId && status) {
        const validStatuses = ["OPEN", "IN_PROGRESS", "REQUIRES_FURTHER_INFO", "RESOLVED"];
        if (!validStatuses.includes(status)) {
          throw new Error(`Status must be one of: ${validStatuses.join(", ")}`);
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
      if ((questionCode || evidenceItemId) && title && message) {
        const trimmedTitle = String(title).trim();
        const trimmedMessage = String(message).trim();

        if (!trimmedTitle || !trimmedMessage) {
          throw new Error("Title and message cannot be empty.");
        }

        let resolvedQuestionCode = questionCode ? String(questionCode).trim() : null;

        if (!resolvedQuestionCode && evidenceItemId) {
          const evRes = await client.query(
            "SELECT question_code FROM evidence_items WHERE id = $1 LIMIT 1;",
            [evidenceItemId]
          );
          if (evRes.rowCount && evRes.rows[0].question_code) {
            resolvedQuestionCode = evRes.rows[0].question_code;
          }
        }

        const threadRes = await client.query(
          `INSERT INTO clarification_threads (
            assessment_id,
            question_code,
            evidence_item_id,
            target_role,
            raised_by_user_id,
            title,
            status
          ) VALUES ($1, $2, $3, $4, $5, $6, 'OPEN')
          RETURNING id, created_at;`,
          [
            assessmentId,
            resolvedQuestionCode || "GENERIC",
            evidenceItemId || null,
            targetRole || null,
            sessionUser.userId,
            trimmedTitle,
          ]
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
          questionCode: resolvedQuestionCode,
          evidenceItemId: evidenceItemId || null,
          targetRole: targetRole || null,
          title: trimmedTitle,
        };
      }

      throw new Error(
        "Invalid clarification payload. Provide either (questionCode/evidenceItemId, title, message) or (threadId, message/status)."
      );
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
