export function normalizeText(value: string | null | undefined) {
  return (value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export function normalizeBarcode(value: string | null | undefined) {
  const digits = (value || "").replace(/\D/g, "");
  if (!digits) return "";

  // UPC-A often appears as EAN-13 with a leading zero. Compare both as UPC-A.
  if (digits.length === 13 && digits.startsWith("0")) return digits.slice(1);

  return digits;
}

export function compactTitleKey(title: string | null | undefined) {
  return normalizeText(title)
    .replace(/\b(the|a|an|game|video game|edition|standard edition)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeFormat(value: string | null | undefined) {
  return value === "DIGITAL" ? "DIGITAL" : "PHYSICAL";
}
