import { ConditionGrade } from "@prisma/client";

export const csvHeaders = [
  "recordType",
  "title",
  "platform",
  "format",
  "barcode",
  "region",
  "edition",
  "condition",
  "maker",
  "modelNumber",
  "serialNumber",
  "pricePaid",
  "currentValue",
  "imageUrl",
  "notes"
];

const validConditions = new Set<string>(Object.values(ConditionGrade));

export function csvEscape(value: unknown) {
  if (value === null || typeof value === "undefined") return "";

  const text = String(value);

  if (/[",\n\r]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }

  return text;
}

export function toCsv(rows: Record<string, unknown>[]) {
  return [
    csvHeaders.join(","),
    ...rows.map((row) => csvHeaders.map((header) => csvEscape(row[header])).join(","))
  ].join("\n");
}

export function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (quoted) {
      if (char === '"' && next === '"') {
        cell += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }

      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") {
      cell += char;
    }
  }

  row.push(cell);
  rows.push(row);

  const [headers, ...dataRows] = rows.filter((candidateRow) =>
    candidateRow.some((candidateCell) => candidateCell.trim().length > 0)
  );

  if (!headers) return [];

  return dataRows.map((dataRow) => {
    const record: Record<string, string> = {};

    headers.forEach((header, index) => {
      record[header.trim()] = dataRow[index] || "";
    });

    return record;
  });
}

export function decimalOrUndefined(value: string | undefined) {
  if (!value) return undefined;

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : undefined;
}

export function stringOrUndefined(value: string | undefined) {
  if (!value) return undefined;

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : undefined;
}

export function conditionOrDefault(value: string | undefined): ConditionGrade {
  const normalized = (value || "GOOD").trim().toUpperCase();

  if (validConditions.has(normalized)) {
    return normalized as ConditionGrade;
  }

  return ConditionGrade.GOOD;
}

export function filenameSafe(value: string) {
  const safe = value.replace(/[^a-zA-Z0-9-_]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");

  return safe || "collection";
}
