import { api, CollectionItem, GameCopy, User } from "@/lib/api";

export type AssetTag = {
  id: string;
  tag: string;
  gameCopyId?: string | null;
  collectionItemId?: string | null;
  notes?: string | null;
  labelStatus?: "NORMAL" | "MISSING" | "DAMAGED";
  labelLastPrintedAt?: string | null;
  gameCopy?: GameCopy & {
    collection?: {
      id: string;
      name: string;
      type: string;
    };
  } | null;
  collectionItem?: CollectionItem & {
    collection?: {
      id: string;
      name: string;
      type: string;
    };
  } | null;
  loans: Loan[];
};

export type Loan = {
  id: string;
  assetTagId: string;
  checkedOutByUserId: string;
  borrowerName: string;
  borrowerEmail?: string | null;
  checkedOutAt: string;
  dueAt?: string | null;
  returnedAt?: string | null;
  status: "CHECKED_OUT" | "RETURNED";
  checkoutNotes?: string | null;
  returnNotes?: string | null;
  checkedOutBy?: Pick<User, "id" | "email" | "name">;
};

export function assetTitle(asset: AssetTag) {
  if (asset.gameCopy) return asset.gameCopy.game.title;
  if (asset.collectionItem) return asset.collectionItem.name;
  return asset.tag;
}

export function assetSubtitle(asset: AssetTag) {
  if (asset.gameCopy) {
    return `${asset.gameCopy.collection?.name || "Collection"} · ${asset.gameCopy.game.platform?.name || "Unknown platform"}`;
  }

  if (asset.collectionItem) {
    return `${asset.collectionItem.collection?.name || "Collection"} · ${asset.collectionItem.category.replaceAll("_", " ")}`;
  }

  return "Unknown asset";
}

export function activeLoan(asset: AssetTag) {
  return asset.loans?.find((loan) => loan.status === "CHECKED_OUT") || null;
}

export function qrUrlForAsset(tag: string) {
  if (typeof window === "undefined") return "";
  const url = `${window.location.origin}/assets/${encodeURIComponent(tag)}`;
  return `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(url)}`;
}

export async function getAssets() {
  return api<{ assets: AssetTag[] }>("/assets");
}

export async function getAsset(tag: string) {
  return api<{ asset: AssetTag; activeLoan: Loan | null }>(`/assets/lookup/${encodeURIComponent(tag)}`);
}
