"use client";

import { X } from "lucide-react";
import { AssetTagLite, User } from "@/lib/api";
import { Branding } from "@/lib/branding";
import { printAssetLabel, SmallAssetLabel } from "@/components/SmallAssetLabel";

export function AssetTagPrintModal({
  open,
  onClose,
  assetTag,
  ownerName,
  ownerEmail,
  branding
}: {
  open: boolean;
  onClose: () => void;
  assetTag: string;
  ownerName?: string | null;
  ownerEmail?: string | null;
  branding?: Branding | null;
}) {
  if (!open) return null;

  const assetTagLite: AssetTagLite = { id: assetTag, tag: assetTag, loans: [] };
  const owner: User | null = ownerEmail || ownerName
    ? {
        id: "label-owner",
        email: ownerEmail || "",
        name: ownerName || ownerEmail || "Owner",
        role: "USER"
      }
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
          <h2 className="text-2xl font-bold">Print {assetTag}</h2>

          <button
            onClick={onClose}
            className="rounded-xl border border-zinc-700 p-2 text-zinc-300 hover:bg-zinc-800"
            aria-label="Close"
            type="button"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-col items-center justify-center gap-5 p-6 text-center">
          <SmallAssetLabel assetTag={assetTagLite} user={owner} branding={branding || { appName: "VGC Shelf", pageTitle: "VGC Shelf", appIconUrl: null }} />

          <button
            type="button"
            onClick={() => printAssetLabel({ assetTag: assetTagLite, user: owner, branding: branding || { appName: "VGC Shelf", pageTitle: "VGC Shelf", appIconUrl: null } })}
            className="rounded-xl px-5 py-3 text-sm font-semibold text-white vgc-accent-bg"
          >
            Print Label
          </button>
        </div>
      </div>
    </div>
  );
}
