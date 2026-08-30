const MONTH_MAP: Record<string, string> = {
  A: "01", B: "02", C: "03", D: "04", E: "05", H: "06",
  L: "07", M: "08", P: "09", R: "10", S: "11", T: "12",
};

export type FiscalCodeInfo = {
  dateOfBirth: string;
  gender: "M" | "F";
  age: number;
};

export function parseFiscalCode(cf: string): FiscalCodeInfo | null {
  const clean = cf.trim().toUpperCase();
  if (clean.length !== 16) return null;

  const yearStr = clean.slice(6, 8);
  const monthLetter = clean.slice(8, 9);
  const dayStr = clean.slice(9, 11);

  const month = MONTH_MAP[monthLetter];
  if (!month) return null;

  const rawDay = parseInt(dayStr, 10);
  if (isNaN(rawDay)) return null;

  const isFemale = rawDay > 40;
  const day = isFemale ? rawDay - 40 : rawDay;
  if (day < 1 || day > 31) return null;

  const twoDigitYear = parseInt(yearStr, 10);
  if (isNaN(twoDigitYear)) return null;

  const currentYear = new Date().getFullYear();
  const currentTwoDigit = currentYear % 100;
  const year = twoDigitYear <= currentTwoDigit ? 2000 + twoDigitYear : 1900 + twoDigitYear;

  const dayPadded = String(day).padStart(2, "0");
  const dateOfBirth = `${year}-${month}-${dayPadded}`;

  const birthDate = new Date(dateOfBirth);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }

  if (age < 0 || age > 130) return null;

  return {
    dateOfBirth,
    gender: isFemale ? "F" : "M",
    age,
  };
}
