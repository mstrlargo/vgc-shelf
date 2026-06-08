export type GamePartType = "DISC" | "CARTRIDGE" | "CASE" | "BOX" | "MANUAL" | "INSERT" | "COVER_ART" | "STEELBOOK" | "AMIIBO" | "OTHER";
export type ConditionGrade = "NEW" | "LIKE_NEW" | "VERY_GOOD" | "GOOD" | "ACCEPTABLE" | "POOR" | "MISSING";

export type PartDraft = {
  type: GamePartType;
  enabled: boolean;
  condition: ConditionGrade;
  notes: string;
};

export const partOptions: Array<{ type: GamePartType; label: string }> = [
  { type: "DISC", label: "Disc" },
  { type: "CARTRIDGE", label: "Cartridge" },
  { type: "CASE", label: "Case" },
  { type: "BOX", label: "Box" },
  { type: "MANUAL", label: "Manual" },
  { type: "INSERT", label: "Insert" },
  { type: "COVER_ART", label: "Cover Art" },
  { type: "STEELBOOK", label: "Steelbook" },
  { type: "AMIIBO", label: "Amiibo" },
  { type: "OTHER", label: "Other" }
];

export const conditionOptions: Array<{ value: ConditionGrade; label: string }> = [
  { value: "NEW", label: "New" },
  { value: "LIKE_NEW", label: "Like New" },
  { value: "VERY_GOOD", label: "Very Good" },
  { value: "GOOD", label: "Good" },
  { value: "ACCEPTABLE", label: "Acceptable" },
  { value: "POOR", label: "Poor" },
  { value: "MISSING", label: "Missing" }
];

export function defaultPartDrafts(): PartDraft[] {
  return partOptions.map((part) => ({ type: part.type, enabled: false, condition: "GOOD", notes: "" }));
}

export function partLabel(type: string) {
  return partOptions.find((part) => part.type === type)?.label || type.replaceAll("_", " ");
}

export function conditionLabel(condition: string) {
  return conditionOptions.find((item) => item.value === condition)?.label || condition.replaceAll("_", " ");
}
