/**
 * One-time migration: converts legacy `valoreRiferimento` JSON strings
 * from the `exams` table into rows in `exam_reference_ranges`.
 *
 * Safe to run multiple times — skips exams that already have structured ranges.
 *
 * Usage: pnpm --filter @workspace/scripts run migrate-ref-values
 */

import { db } from "@workspace/db";
import { examsTable, examReferenceRangesTable } from "@workspace/db";
import { isNotNull, eq } from "drizzle-orm";

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

function legacyToRangeValues(ref: LegacyRef): {
  valoreMin: string | null;
  valoreMax: string | null;
} {
  if (ref.type === "range") {
    return {
      valoreMin: ref.min != null ? String(ref.min) : null,
      valoreMax: ref.max != null ? String(ref.max) : null,
    };
  }
  if (ref.type === ">") return { valoreMin: String(ref.value), valoreMax: null };
  if (ref.type === ">=") return { valoreMin: String(ref.value), valoreMax: null };
  if (ref.type === "<") return { valoreMin: null, valoreMax: String(ref.value) };
  if (ref.type === "<=") return { valoreMin: null, valoreMax: String(ref.value) };
  return { valoreMin: null, valoreMax: null };
}

async function main() {
  console.log("🔍 Caricamento esami con valoreRiferimento...");

  const exams = await db
    .select()
    .from(examsTable)
    .where(isNotNull(examsTable.valoreRiferimento));

  console.log(`   Trovati ${exams.length} esami con valore legacy.`);

  let skipped = 0;
  let migrated = 0;
  let invalid = 0;

  for (const exam of exams) {
    const legacyStr = exam.valoreRiferimento;
    if (!legacyStr) continue;

    const ref = parseLegacy(legacyStr);
    if (!ref) {
      console.warn(`   ⚠️  ID ${exam.id} (${exam.codiceAnalisi}): JSON non valido — "${legacyStr}"`);
      invalid++;
      continue;
    }

    const existing = await db
      .select({ id: examReferenceRangesTable.id })
      .from(examReferenceRangesTable)
      .where(eq(examReferenceRangesTable.examId, exam.id))
      .limit(1);

    if (existing.length > 0) {
      skipped++;
      continue;
    }

    const { valoreMin, valoreMax } = legacyToRangeValues(ref);

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
    console.log(
      `   ✅ ID ${exam.id} (${exam.codiceAnalisi}): ${valoreMin ?? "?"} – ${valoreMax ?? "?"} ${exam.um ?? ""}`
    );
  }

  console.log("\n📊 Riepilogo:");
  console.log(`   Migrati:  ${migrated}`);
  console.log(`   Saltati (già esistenti): ${skipped}`);
  console.log(`   Non validi: ${invalid}`);
  console.log("\n✅ Migrazione completata.");

  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Errore:", err);
  process.exit(1);
});
