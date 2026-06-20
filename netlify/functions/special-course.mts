import type { Context } from "@netlify/functions";
import { getDatabase } from "@netlify/database";

// Backs the 暑期特選課程 (Summer Special Course) track. This is intentionally
// kept separate from the existing Google-Sheets data store used by the
// Part A/B/C flow — that store must not be altered. The special course is a
// brand-new, independent track persisted in Netlify Database.

type SessionInput = { date?: string; slot?: string };

const jsonHeaders = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};

const clean = (v: unknown) => String(v ?? "").trim();
const cleanDate = (v: unknown) => {
  const m = String(v ?? "").match(/(\d{1,2})\/(\d{1,2})/);
  return m ? `${m[1].padStart(2, "0")}/${m[2].padStart(2, "0")}` : "";
};

export default async (req: Request, _context: Context) => {
  const db = getDatabase();

  try {
    if (req.method === "GET") {
      const rows = await db.sql`
        SELECT id, student_name, gender, grade_text, is_secondary,
               session_date, time_slot, fee, created_at
        FROM special_course_sessions
        ORDER BY created_at ASC, id ASC
      `;
      return new Response(JSON.stringify(rows), { headers: jsonHeaders });
    }

    if (req.method === "POST") {
      const body = await req.json().catch(() => ({} as Record<string, unknown>));
      const action = clean(body.action) || "register";

      if (action === "delete") {
        const name = clean(body.name);
        if (!name) {
          return new Response(JSON.stringify({ error: "name required" }), {
            status: 400,
            headers: jsonHeaders,
          });
        }
        await db.sql`DELETE FROM special_course_sessions WHERE student_name = ${name}`;
        return new Response(JSON.stringify({ ok: true, deleted: name }), {
          headers: jsonHeaders,
        });
      }

      if (action === "register") {
        const name = clean(body.name);
        const gender = clean(body.gender);
        const gradeText = clean(body.gradeText);
        const isSecondary = Boolean(body.isSecondary);
        const fee = Number(body.feePerSession) || 0;
        const sessions: SessionInput[] = Array.isArray(body.sessions)
          ? (body.sessions as SessionInput[])
          : [];

        const rows = sessions
          .map((s) => ({ date: cleanDate(s.date), slot: clean(s.slot) }))
          .filter((s) => s.date && s.slot);

        if (!name || rows.length === 0) {
          return new Response(
            JSON.stringify({ error: "name and at least one session required" }),
            { status: 400, headers: jsonHeaders },
          );
        }

        // Re-registration replaces any previous special-course booking for this
        // student so the record always reflects the latest submission.
        await db.sql`DELETE FROM special_course_sessions WHERE student_name = ${name}`;

        for (const r of rows) {
          await db.sql`
            INSERT INTO special_course_sessions
              (student_name, gender, grade_text, is_secondary, session_date, time_slot, fee)
            VALUES
              (${name}, ${gender}, ${gradeText}, ${isSecondary}, ${r.date}, ${r.slot}, ${fee})
          `;
        }

        return new Response(
          JSON.stringify({ ok: true, name, count: rows.length, total: rows.length * fee }),
          { headers: jsonHeaders },
        );
      }

      return new Response(JSON.stringify({ error: "unknown action" }), {
        status: 400,
        headers: jsonHeaders,
      });
    }

    return new Response("Method not allowed", { status: 405 });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "server error" }),
      { status: 500, headers: jsonHeaders },
    );
  }
};

export const config = {
  path: "/api/special-course",
};
