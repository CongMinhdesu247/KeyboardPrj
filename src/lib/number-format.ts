export function normalizeVndDigits(input: string): string {
  const digits = input.replace(/\D/g, "");
  if (!digits) return "";
  return digits.replace(/^0+(?=\d)/, "");
}

export function formatVndDigits(
  input: string | number | null | undefined,
): string {
  if (input === null || input === undefined) return "";
  const raw = normalizeVndDigits(String(input));
  if (!raw) return "";
  return raw.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

export function caretPositionForDigitIndex(
  formatted: string,
  digitIndex: number,
): number {
  if (digitIndex <= 0) return 0;
  let seen = 0;
  for (let i = 0; i < formatted.length; i++) {
    const ch = formatted[i];
    if (ch >= "0" && ch <= "9") {
      seen++;
      if (seen === digitIndex) return i + 1;
    }
  }
  return formatted.length;
}
