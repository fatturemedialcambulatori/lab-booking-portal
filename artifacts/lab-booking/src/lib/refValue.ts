// ─── Legacy (JSON string) ref value ──────────────────────────────────────────

export type RefType = "" | "range" | ">" | "<" | ">=" | "<=";

export interface RefValue {
  type: RefType;
  min?: number;
  max?: number;
  value?: number;
}

export const REF_TYPE_LABELS: { value: RefType; label: string }[] = [
  { value: "", label: "Nessuno" },
  { value: "range", label: "Range (min – max)" },
  { value: ">", label: "> Maggiore di" },
  { value: ">=", label: "≥ Maggiore o uguale a" },
  { value: "<", label: "< Minore di" },
  { value: "<=", label: "≤ Minore o uguale a" },
];

export function parseRefValue(str: string | null | undefined): RefValue {
  if (!str) return { type: "" };
  try {
    const parsed = JSON.parse(str);
    if (parsed && typeof parsed.type === "string") return parsed as RefValue;
    return { type: "" };
  } catch {
    return { type: "" };
  }
}

export function buildRefString(
  type: RefType,
  min: string,
  max: string,
  single: string
): string | null {
  if (!type) return null;
  if (type === "range") {
    const mn = parseFloat(min.replace(",", "."));
    const mx = parseFloat(max.replace(",", "."));
    if (isNaN(mn) && isNaN(mx)) return null;
    const obj: RefValue = { type };
    if (!isNaN(mn)) obj.min = mn;
    if (!isNaN(mx)) obj.max = mx;
    return JSON.stringify(obj);
  }
  const val = parseFloat(single.replace(",", "."));
  if (isNaN(val)) return null;
  return JSON.stringify({ type, value: val });
}

export function displayRefValue(str: string | null | undefined): string {
  const ref = parseRefValue(str);
  switch (ref.type) {
    case "range":
      return `${ref.min ?? "?"} – ${ref.max ?? "?"}`;
    case ">":
      return `> ${ref.value ?? "?"}`;
    case "<":
      return `< ${ref.value ?? "?"}`;
    case ">=":
      return `≥ ${ref.value ?? "?"}`;
    case "<=":
      return `≤ ${ref.value ?? "?"}`;
    default:
      return "—";
  }
}

export function isOutOfRange(
  str: string | null | undefined,
  resultStr: string | null | undefined
): boolean {
  if (!str || !resultStr) return false;
  const ref = parseRefValue(str);
  if (!ref.type) return false;
  const value = parseFloat(String(resultStr).replace(",", "."));
  if (isNaN(value)) return false;
  switch (ref.type) {
    case "range":
      if (ref.min != null && value < ref.min) return true;
      if (ref.max != null && value > ref.max) return true;
      return false;
    case ">":
      return ref.value != null && value <= ref.value;
    case "<":
      return ref.value != null && value >= ref.value;
    case ">=":
      return ref.value != null && value < ref.value;
    case "<=":
      return ref.value != null && value > ref.value;
    default:
      return false;
  }
}

// ─── Structured reference ranges ─────────────────────────────────────────────

export type Fascia = {
  label: string;
  min?: number | null;
  max?: number | null;
  color?: string | null;
  nota?: string | null;
};

export type StructuredRefRange = {
  id: number;
  examId: number;
  gender?: string | null;
  ageMin?: number | null;
  ageMax?: number | null;
  statoFisiologico?: string | null;
  tipo: string;
  valoreMin?: number | null;
  valoreMax?: number | null;
  valoriAccettabili?: string | null;
  fasce?: Fascia[] | null;
  unita?: string | null;
  note?: string | null;
  ordinamento: number;
};

/** Find the best matching range for a patient, given gender and age in years. */
export function getApplicableRange(
  ranges: StructuredRefRange[],
  gender?: string | null,
  ageYears?: number | null,
  statoFisiologico?: string | null
): StructuredRefRange | null {
  if (!ranges.length) return null;

  const matches = ranges.filter((r) => {
    if (r.gender && gender && r.gender !== gender) return false;
    if (r.ageMin != null && ageYears != null && ageYears < r.ageMin) return false;
    if (r.ageMax != null && ageYears != null && ageYears > r.ageMax) return false;
    if (r.statoFisiologico && r.statoFisiologico !== (statoFisiologico ?? null)) return false;
    return true;
  });

  // Prefer most specific match (more conditions set = higher specificity)
  const scored = matches.map((r) => {
    let score = 0;
    if (r.gender) score += 4;
    if (r.ageMin != null || r.ageMax != null) score += 2;
    if (r.statoFisiologico) score += 1;
    return { r, score };
  });

  scored.sort((a, b) => b.score - a.score || a.r.ordinamento - b.r.ordinamento);
  return scored[0]?.r ?? null;
}

/** Returns all matching ranges (useful for display in referto). */
export function getApplicableRanges(
  ranges: StructuredRefRange[],
  gender?: string | null,
  ageYears?: number | null
): StructuredRefRange[] {
  return ranges.filter((r) => {
    if (r.gender && gender && r.gender !== gender) return false;
    if (r.ageMin != null && ageYears != null && ageYears < r.ageMin) return false;
    if (r.ageMax != null && ageYears != null && ageYears > r.ageMax) return false;
    return true;
  }).sort((a, b) => a.ordinamento - b.ordinamento);
}

/** Human-readable label for a structured range's conditions. */
export function describeRangeConditions(r: StructuredRefRange): string {
  const parts: string[] = [];
  if (r.gender === "M") parts.push("Maschio");
  else if (r.gender === "F") parts.push("Femmina");
  if (r.ageMin != null && r.ageMax != null) parts.push(`${r.ageMin}–${r.ageMax} anni`);
  else if (r.ageMin != null) parts.push(`≥ ${r.ageMin} anni`);
  else if (r.ageMax != null) parts.push(`≤ ${r.ageMax} anni`);
  if (r.statoFisiologico) parts.push(r.statoFisiologico.charAt(0).toUpperCase() + r.statoFisiologico.slice(1));
  return parts.length ? parts.join(", ") : "Tutti";
}

/** Human-readable display string for a structured range's value. */
export function displayStructuredRange(r: StructuredRefRange): string {
  if (r.tipo === "range") {
    const min = r.valoreMin != null ? String(r.valoreMin) : null;
    const max = r.valoreMax != null ? String(r.valoreMax) : null;
    if (min && max) return `${min} – ${max}`;
    if (min) return `≥ ${min}`;
    if (max) return `≤ ${max}`;
    return "—";
  }
  if (r.tipo === "gte") return r.valoreMin != null ? `≥ ${r.valoreMin}` : "—";
  if (r.tipo === "gt")  return r.valoreMin != null ? `> ${r.valoreMin}` : "—";
  if (r.tipo === "lte") return r.valoreMax != null ? `≤ ${r.valoreMax}` : "—";
  if (r.tipo === "lt")  return r.valoreMax != null ? `< ${r.valoreMax}` : "—";
  if (r.tipo === "qualitative") {
    return r.valoriAccettabili ?? "—";
  }
  if (r.tipo === "fasce" && r.fasce?.length) {
    return r.fasce.map((f) => {
      if (f.min != null && f.max != null) return `${f.label}: ${f.min}–${f.max}`;
      if (f.min != null) return `${f.label}: ≥ ${f.min}`;
      if (f.max != null) return `${f.label}: < ${f.max}`;
      return f.label;
    }).join(" / ");
  }
  return "—";
}

/**
 * For fasce: returns the fascia that matches a numeric value, or null if none matches.
 * Matching rules:
 *   - min only → value >= min
 *   - max only → value < max
 *   - min + max → min <= value < max
 *   - neither → catch-all (always matches)
 * Returns the first matching fascia in order.
 */
export function matchFascia(r: StructuredRefRange, valueStr: string | null | undefined): Fascia | null {
  if (!r.fasce?.length || !valueStr) return null;
  const value = parseFloat(String(valueStr).replace(",", "."));
  if (isNaN(value)) return null;

  for (const f of r.fasce) {
    const hasMin = f.min != null;
    const hasMax = f.max != null;
    if (!hasMin && !hasMax) return f; // catch-all
    if (hasMin && hasMax) {
      if (value >= f.min! && value < f.max!) return f;
    } else if (hasMin) {
      if (value >= f.min!) return f;
    } else {
      if (value < f.max!) return f;
    }
  }
  return null;
}

const OUT_OF_RANGE_COLORS = new Set(["red", "orange"]);

/** Check if a result is out of range for a structured range entry. */
export function isOutOfRangeStructured(
  r: StructuredRefRange,
  resultStr: string | null | undefined
): boolean {
  if (!resultStr) return false;

  const numericTipos = ["range", "gt", "gte", "lt", "lte"];
  if (numericTipos.includes(r.tipo)) {
    const value = parseFloat(String(resultStr).replace(",", "."));
    if (isNaN(value)) return false;
    if (r.tipo === "range") {
      if (r.valoreMin != null && value < Number(r.valoreMin)) return true;
      if (r.valoreMax != null && value > Number(r.valoreMax)) return true;
      return false;
    }
    if (r.tipo === "gte") return r.valoreMin != null && value < Number(r.valoreMin);
    if (r.tipo === "gt")  return r.valoreMin != null && value <= Number(r.valoreMin);
    if (r.tipo === "lte") return r.valoreMax != null && value > Number(r.valoreMax);
    if (r.tipo === "lt")  return r.valoreMax != null && value >= Number(r.valoreMax);
  }

  if (r.tipo === "qualitative" && r.valoriAccettabili) {
    const acceptable = r.valoriAccettabili.split(",").map((v) => v.trim().toLowerCase());
    return !acceptable.includes(resultStr.trim().toLowerCase());
  }

  if (r.tipo === "fasce") {
    const fascia = matchFascia(r, resultStr);
    if (!fascia) return false;
    return OUT_OF_RANGE_COLORS.has(fascia.color ?? "");
  }

  return false;
}

/** Check out-of-range using structured ranges if available, falling back to legacy JSON string. */
export function isOutOfRangeAny(
  ranges: StructuredRefRange[] | null | undefined,
  legacyStr: string | null | undefined,
  resultStr: string | null | undefined,
  gender?: string | null,
  ageYears?: number | null
): boolean {
  if (ranges?.length) {
    const applicable = getApplicableRange(ranges, gender, ageYears);
    if (applicable) return isOutOfRangeStructured(applicable, resultStr);
  }
  return isOutOfRange(legacyStr, resultStr);
}

/** Get the display string for the best applicable range, using structured ranges if available. */
export function displayRefValueAny(
  ranges: StructuredRefRange[] | null | undefined,
  legacyStr: string | null | undefined,
  gender?: string | null,
  ageYears?: number | null
): string {
  if (ranges?.length) {
    const applicable = getApplicableRange(ranges, gender, ageYears);
    if (applicable) return displayStructuredRange(applicable);
  }
  return displayRefValue(legacyStr);
}
