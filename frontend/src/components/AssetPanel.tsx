"use client";

import { useState } from "react";
import { api, AssetTagLite, User } from "@/lib/api";
import { Branding } from "@/lib/branding";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Modal } from "@/components/Modal";
import { SmallAssetLabel, printAssetLabel } from "@/components/SmallAssetLabel";
import { CheckCircle2, LogIn, LogOut, Printer, QrCode } from "lucide-react";

type CollectionTypeForAsset = "GAMES" | "SYSTEMS" | "PERIPHERALS" | "TOYS_TO_LIFE" | string;

type AssetPanelProps = {
  assetTag?: AssetTagLite | null;
  gameCopyId?: string;
  collectionItemId?: string;
  collectionType: CollectionTypeForAsset;
  canEdit: boolean;
  user: User | null;
  branding: Branding;
  onChanged: () => void | Promise<void>;
};

function currentLoan(assetTag: AssetTagLite | null | undefined) {
  const directLoan = (assetTag as any)?.currentLoan;

  if (directLoan && (directLoan.status === "CHECKED_OUT" || !directLoan.returnedAt)) {
    return directLoan;
  }

  const activeLoan = (assetTag as any)?.loans?.find?.((loan: any) => {
    return loan?.status === "CHECKED_OUT" || !loan?.returnedAt;
  });

  return activeLoan || null;
}

function collectionItemAssetType(collectionType: CollectionTypeForAsset) {
  if (collectionType === "SYSTEMS") return "SYSTEM";
  if (collectionType === "PERIPHERALS") return "PERIPHERAL";
  if (collectionType === "TOYS_TO_LIFE") return "TOYS_TO_LIFE";

  return "COLLECTION_ITEM";
}

function toCheckoutDateTime(value: string) {
  if (!value) return null;

  return new Date(`${value}T12:00:00`).toISOString();
}

export function AssetPanel({
  assetTag,
  gameCopyId,
  collectionItemId,
  collectionType,
  canEdit,
  user,
  branding,
  onChanged
}: AssetPanelProps) {
  const [showPrint, setShowPrint] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [borrowerName, setBorrowerName] = useState("");
  const [borrowerEmail, setBorrowerEmail] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState("");

  const loan = currentLoan(assetTag);
  const checkedOut = Boolean(loan);

  async function createTag() {
    setMessage("");

    try {
      try {
        const tagData = await api<{ tag: string }>(`/assets/next-tag?type=${encodeURIComponent(collectionType || "GAMES")}`);

        await api("/assets", {
          method: "POST",
          body: JSON.stringify({
            tag: tagData.tag,
            gameCopyId: gameCopyId || null,
            collectionItemId: collectionItemId || null,
            notes: null
          })
        });

        await onChanged();
        return;
      } catch (firstErr: any) {
        const payloads = gameCopyId
          ? [
              { type: "GAME_COPY", gameCopyId },
              { assetType: "GAME_COPY", gameCopyId },
              { entityType: "GAME_COPY", gameCopyId }
            ]
          : [
              { type: collectionItemAssetType(collectionType), collectionItemId },
              { type: "COLLECTION_ITEM", collectionItemId },
              { assetType: collectionItemAssetType(collectionType), collectionItemId },
              { entityType: "COLLECTION_ITEM", collectionItemId }
            ];

        let lastError = firstErr.message || "Failed to create asset tag.";

        for (const payload of payloads) {
          try {
            await api("/assets", {
              method: "POST",
              body: JSON.stringify(payload)
            });

            await onChanged();
            return;
          } catch (err: any) {
            lastError = err.message || lastError;
          }
        }

        throw new Error(lastError);
      }
    } catch (err: any) {
      setMessage(err.message || "Failed to create asset tag.");
    }
  }

  async function checkOut(e: React.FormEvent) {
    e.preventDefault();

    if (!assetTag) return;

    setMessage("");

    try {
      await api(`/assets/${assetTag.id}/checkout`, {
        method: "POST",
        body: JSON.stringify({
          borrowerName,
          borrowerEmail: borrowerEmail || null,
          dueAt: toCheckoutDateTime(dueAt),
          checkoutNotes: notes || null,
          notes: notes || null
        })
      });

      setBorrowerName("");
      setBorrowerEmail("");
      setDueAt("");
      setNotes("");
      setShowCheckout(false);
      await onChanged();
    } catch (err: any) {
      setMessage(err.message || "Failed to check out asset.");
    }
  }

  async function checkIn() {
    if (!assetTag) return;

    setMessage("");

    try {
      await api(`/assets/${assetTag.id}/checkin`, {
        method: "POST",
        body: JSON.stringify({
          returnNotes: null
        })
      });

      await onChanged();
    } catch (err: any) {
      const errorMessage = err.message || "Failed to check in asset.";
      setMessage(errorMessage);

      if (errorMessage.toLowerCase().includes("not currently checked out")) {
        await onChanged();
      }
    }
  }

  if (!assetTag) {
    if (!canEdit) return null;

    return (
      <div className="mt-3 rounded-xl border border-zinc-800 bg-zinc-900/50 p-3">
        <button
          type="button"
          onClick={createTag}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
        >
          <QrCode className="h-4 w-4 vgc-accent-text" />
          Create Asset Tag
        </button>

        {message && <p className="mt-2 text-xs text-red-300">{message}</p>}
      </div>
    );
  }

  return (
    <>
      <div className="mt-3 rounded-xl border border-zinc-800 bg-zinc-900/50 p-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <QrCode className="h-4 w-4 shrink-0 vgc-accent-text" />
            <span className="break-all font-mono text-sm font-semibold">{assetTag.tag}</span>
          </div>

          <div className={`mt-2 flex items-center gap-2 text-sm ${checkedOut ? "text-amber-300" : "text-green-300"}`}>
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span className="min-w-0">
              {checkedOut
                ? `Checked out${loan?.borrowerName ? ` to ${loan.borrowerName}` : ""}`
                : "In collection"}
            </span>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3">
          {canEdit && (
            checkedOut ? (
              <Button
                type="button"
                onClick={checkIn}
                className="flex min-h-[56px] items-center justify-center gap-2 px-4 py-3"
              >
                <LogIn className="h-4 w-4 shrink-0" />
                <span>Check in</span>
              </Button>
            ) : (
              <Button
                type="button"
                onClick={() => setShowCheckout(true)}
                className="flex min-h-[56px] items-center justify-center gap-2 px-4 py-3"
              >
                <LogOut className="h-4 w-4 shrink-0" />
                <span>Check out</span>
              </Button>
            )
          )}

          <button
            type="button"
            onClick={() => setShowPrint(true)}
            className="flex min-h-[56px] items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm font-medium text-zinc-200 transition hover:bg-zinc-800"
          >
            <Printer className="h-4 w-4 shrink-0" />
            <span>Print Label</span>
          </button>
        </div>

        {message && <p className="mt-2 text-xs text-red-300">{message}</p>}
      </div>

      {showPrint && (
        <Modal title={`Print ${assetTag.tag}`} onClose={() => setShowPrint(false)} maxWidth="max-w-md">
          <div className="flex flex-col items-center gap-4">
            <SmallAssetLabel assetTag={assetTag} user={user} branding={branding} />

            <Button
              type="button"
              onClick={() => printAssetLabel({ assetTag, user, branding })}
            >
              Print Label
            </Button>
          </div>
        </Modal>
      )}

      {showCheckout && (
        <Modal title={`Check out ${assetTag.tag}`} onClose={() => setShowCheckout(false)} maxWidth="max-w-xl">
          <form onSubmit={checkOut} className="space-y-4">
            <label className="block">
              <span className="mb-1 block text-sm font-medium">Borrower name</span>
              <Input
                value={borrowerName}
                onChange={(e) => setBorrowerName(e.target.value)}
                placeholder="Name"
                required
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium">Borrower email</span>
              <Input
                value={borrowerEmail}
                onChange={(e) => setBorrowerEmail(e.target.value)}
                placeholder="Email"
                type="email"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium">Due date</span>
              <Input
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
                type="date"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium">Notes</span>
              <textarea
                className="min-h-28 w-full resize-y rounded-xl border border-zinc-700 bg-white px-3 py-2 text-sm leading-6 text-zinc-950 outline-none ring-indigo-500 placeholder:text-zinc-500 focus:ring-2"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Loan notes"
              />
            </label>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <Button type="submit" className="flex min-h-[48px] items-center justify-center">
                Check out
              </Button>

              <button
                type="button"
                onClick={() => setShowCheckout(false)}
                className="min-h-[48px] rounded-xl border border-zinc-700 px-4 py-2 text-sm font-semibold hover:bg-zinc-800"
              >
                Cancel
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
