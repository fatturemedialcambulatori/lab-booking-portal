/**
 * One-time data migration: converts legacy `valoreRiferimento` JSON strings
 * from `exams` into rows in `exam_reference_ranges`.
 *
 * Safe to call repeatedly — skips exams that already have structured ranges.
 * Runs automatically at server startup.
 */

import { db } from "@workspace/db";
import { examsTable, examReferenceRangesTable } from "@workspace/db";
import { isNotNull, notInArray, sql } from "drizzle-orm";
import { type Logger } from "pino";

type LegacyRef =
  | { type: "range"; min?: number; max?: number }
  | { type: ">" | ">=" | "<" | "<="; value: number };

function parseLegacy(s: string): LegacyRef | null {
  try {
    const obj = JSON.parse(s);
    if (!obj || typeof obj.type !== "string") return null;
    return obj as LegacyRef;
  } catch {
    return null;
  }
}

export async function migrateRefValues(log: Logger): Promise<void> {
  try {
    const alreadyMigratedSubquery = db
      .selectDistinct({ examId: examReferenceRangesTable.examId })
      .from(examReferenceRangesTable);

    const exams = await db
      .select()
      .from(examsTable)
      .where(
        sql`${examsTable.valoreRiferimento} IS NOT NULL AND ${examsTable.id} NOT IN (${alreadyMigratedSubquery})`
      );

    if (exams.length === 0) return;

    log.info({ count: exams.length }, "Migrating legacy reference values");

    let migrated = 0;
    let invalid = 0;

    for (const exam of exams) {
      const legacyStr = exam.valoreRiferimento;
      if (!legacyStr) continue;

      const ref = parseLegacy(legacyStr);
      if (!ref) {
        log.warn({ examId: exam.id, codice: exam.codiceAnalisi }, "Invalid legacy ref JSON — skipping");
        invalid++;
        continue;
      }

      let valoreMin: string | null = null;
      let valoreMax: string | null = null;

      if (ref.type === "range") {
        valoreMin = ref.min != null ? String(ref.min) : null;
        valoreMax = ref.max != null ? String(ref.max) : null;
      } else if (ref.type === ">" || ref.type === ">=") {
        valoreMin = ref.value != null ? String(ref.value) : null;
      } else if (ref.type === "<" || ref.type === "<=") {
        valoreMax = ref.value != null ? String(ref.value) : null;
      }

      await db.insert(examReferenceRangesTable).values({
        examId: exam.id,
        gender: null,
        ageMin: null,
        ageMax: null,
        statoFisiologico: null,
        tipo: "range",
        valoreMin,
        valoreMax,
        valoriAccettabili: null,
        fasce: null,
        unita: exam.um ?? null,
        note: null,
        ordinamento: 0,
      });

      migrated++;
    }

    log.info({ migrated, invalid }, "Legacy reference value migration complete");
  } catch (err) {
    log.error({ err }, "Failed to migrate legacy reference values");
  }
}
