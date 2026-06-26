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
