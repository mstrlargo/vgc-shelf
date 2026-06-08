import { Archive, Gamepad2, Joystick, Package } from "lucide-react";
import { CollectionType } from "@/lib/api";

export const collectionTypes: Array<{ value: CollectionType; label: string }> = [
  { value: "GAMES", label: "Games" },
  { value: "SYSTEMS", label: "Systems" },
  { value: "PERIPHERALS", label: "Peripherals" },
  { value: "TOYS_TO_LIFE", label: "Toys-to-life" }
];

export function collectionTypeLabel(type?: CollectionType) {
  return collectionTypes.find((item) => item.value === type)?.label || "Games";
}

export function itemNoun(type?: CollectionType) {
  if (type === "SYSTEMS") return "System";
  if (type === "PERIPHERALS") return "Peripheral";
  if (type === "TOYS_TO_LIFE") return "Toy-to-life";
  return "Item";
}

export function collectionIcon(type?: CollectionType) {
  if (type === "SYSTEMS") return <Archive className="h-5 w-5 vgc-accent-text" />;
  if (type === "PERIPHERALS") return <Joystick className="h-5 w-5 vgc-accent-text" />;
  if (type === "TOYS_TO_LIFE") return <Package className="h-5 w-5 vgc-accent-text" />;
  return <Gamepad2 className="h-5 w-5 vgc-accent-text" />;
}
