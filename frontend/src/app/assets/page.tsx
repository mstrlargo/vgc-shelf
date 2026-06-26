"use client";

import { useEffect, useMemo, useState } from "react";
import {
  activeLoan,
  assetSubtitle,
  assetTitle,
  AssetTag,
  getAssets,
  qrUrlForAsset,
} from "@/lib/assets";
import { api, CollectionItem, CollectionType, GameCopy } from "@/lib/api";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { Modal } from "@/components/Modal";
import { Shell } from "@/components/Shell";
import { Plus, Search } from "lucide-react";

type EligibleCopy = GameCopy & {
  collection: { id: string; name: string; type: CollectionType };
};
type EligibleItem = CollectionItem & {
  collection: { id: string; name: string; type: CollectionType };
};
type AssetCreateType = "GAMES" | "SYSTEMS" | "PERIPHERALS" | "TOYS_TO_LIFE";

const assetTypes: Array<{ value: AssetCreateType; label: string }> = [
  { value: "GAMES", label: "Game" },
  { value: "SYSTEMS", label: "System" },
  { value: "PERIPHERALS", label: "Peripheral" },
  { value: "TOYS_TO_LIFE", label: "Toys-to-life" },
];

function typeLabel(type: AssetCreateType) {
  return (
    assetTypes.find((assetType) => assetType.value === type)?.label || type
  );
}

function assetCollection(asset: AssetTag) {
  const collection =
    asset.gameCopy?.collection || asset.collectionItem?.collection || null;

  return {
    id: collection?.id || "unassigned",
    name: collection?.name || "Unassigned assets",
    type: collection?.type || null,
  };
}

function sortAssetTags(left: AssetTag, right: AssetTag) {
  return left.tag.localeCompare(right.tag, undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

export default function AssetsPage() {
  const [assets, setAssets] = useState<AssetTag[]>([]);
  const [eligibleCopies, setEligibleCopies] = useState<EligibleCopy[]>([]);
  const [eligibleItems, setEligibleItems] = useState<EligibleItem[]>([]);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [selectedAsset, setSelectedAsset] = useState<AssetTag | null>(null);
  const [showCreateTag, setShowCreateTag] = useState(false);

  const [assetType, setAssetType] = useState<AssetCreateType>("GAMES");
  const [targetId, setTargetId] = useState("");
  const [newTag, setNewTag] = useState("");
  const [tagNotes, setTagNotes] = useState("");

  const [borrowerName, setBorrowerName] = useState("");
  const [borrowerEmail, setBorrowerEmail] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [checkoutNotes, setCheckoutNotes] = useState("");
  const [returnNotes, setReturnNotes] = useState("");

  const filteredTargets = useMemo(() => {
    if (assetType === "GAMES") return eligibleCopies;
    return eligibleItems.filter((item) => item.collection.type === assetType);
  }, [assetType, eligibleCopies, eligibleItems]);

  async function load() {
    const [assetData, eligibleData] = await Promise.all([
      getAssets(),
      api<{ gameCopies: EligibleCopy[]; collectionItems: EligibleItem[] }>(
        "/assets/eligible",
      ),
    ]);

    setAssets(assetData.assets);
    setEligibleCopies(eligibleData.gameCopies);
    setEligibleItems(eligibleData.collectionItems);
  }

  async function generateNextTag(type: AssetCreateType) {
    try {
      const data = await api<{ tag: string }>(`/assets/next-tag?type=${type}`);
      setNewTag(data.tag);
    } catch (err: any) {
      setMessage(err.message || "Failed to generate asset tag.");
    }
  }

  async function openCreateTag() {
    setAssetType("GAMES");
    setTagNotes("");
    setShowCreateTag(true);
    await generateNextTag("GAMES");
  }

  async function createTag(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");

    try {
      await api("/assets", {
        method: "POST",
        body: JSON.stringify({
          tag: newTag,
          gameCopyId: assetType === "GAMES" ? targetId : null,
          collectionItemId: assetType !== "GAMES" ? targetId : null,
          notes: tagNotes || null,
        }),
      });

      setShowCreateTag(false);
      setTargetId("");
      setNewTag("");
      setTagNotes("");
      setMessage("Asset tag created.");
      await load();
    } catch (err: any) {
      setMessage(err.message || "Failed to create asset tag.");
    }
  }

  async function checkout(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedAsset) return;

    setMessage("");

    try {
      await api(`/assets/${selectedAsset.id}/checkout`, {
        method: "POST",
        body: JSON.stringify({
          borrowerName,
          borrowerEmail: borrowerEmail || null,
          dueAt: dueAt ? new Date(dueAt).toISOString() : null,
          checkoutNotes: checkoutNotes || null,
        }),
      });

      setSelectedAsset(null);
      setBorrowerName("");
      setBorrowerEmail("");
      setDueAt("");
      setCheckoutNotes("");
      setMessage("Asset checked out.");
      await load();
    } catch (err: any) {
      setMessage(err.message || "Failed to check out asset.");
    }
  }

  async function checkin(asset: AssetTag) {
    setMessage("");

    try {
      await api(`/assets/${asset.id}/checkin`, {
        method: "POST",
        body: JSON.stringify({
          returnNotes: returnNotes || null,
        }),
      });

      setReturnNotes("");
      setMessage("Asset checked in.");
      await load();
    } catch (err: any) {
      setMessage(err.message || "Failed to check in asset.");
    }
  }

  const filteredAssets = assets.filter((asset) => {
    const haystack =
      `${asset.tag} ${assetTitle(asset)} ${assetSubtitle(asset)}`.toLowerCase();
    return haystack.includes(query.toLowerCase());
  });

  const groupedAssets = useMemo(() => {
    const groups = new Map<
      string,
      { id: string; name: string; assets: AssetTag[] }
    >();

    for (const asset of filteredAssets) {
      const collection = assetCollection(asset);

      if (!groups.has(collection.id)) {
        groups.set(collection.id, {
          id: collection.id,
          name: collection.name,
          assets: [],
        });
      }

      groups.get(collection.id)!.assets.push(asset);
    }

    return Array.from(groups.values())
      .map((group) => ({
        ...group,
        assets: group.assets.sort(sortAssetTags),
      }))
      .sort((left, right) => {
        if (left.id === "unassigned") return 1;
        if (right.id === "unassigned") return -1;
        return left.name.localeCompare(right.name, undefined, {
          numeric: true,
          sensitivity: "base",
        });
      });
  }, [filteredAssets]);

  useEffect(() => {
    load().catch((err) => setMessage(err.message));
  }, []);

  useEffect(() => {
    if (!showCreateTag) return;

    const firstTarget = filteredTargets[0]?.id || "";
    setTargetId(firstTarget);
  }, [assetType, filteredTargets, showCreateTag]);

  return (
    <Shell>
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-3xl font-bold">Asset Tags & Lending</h2>
          <p className="vgc-muted text-sm text-zinc-400">
            Print QR tags, scan assets, check items out, and track returns.
          </p>
        </div>

        <Button type="button" onClick={openCreateTag}>
          <Plus className="mr-2 h-4 w-4" />
          Create asset tag
        </Button>
      </div>

      {message && (
        <p className="mb-6 rounded-lg bg-zinc-800 p-3 text-sm">{message}</p>
      )}

      <Card>
        <div className="mb-5 flex items-center gap-2">
          <Search className="h-5 w-5 vgc-accent-text" />
          <Input
            placeholder="Search assets by tag, title, or collection"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className="space-y-8">
          {groupedAssets.map((group) => (
            <section key={group.id} className="space-y-4">
              <div className="border-b border-zinc-800 pb-2">
                <h3 className="text-xl font-bold">{group.name}</h3>
                <p className="vgc-muted text-sm text-zinc-400">
                  {group.assets.length} asset
                  {group.assets.length === 1 ? "" : "s"}
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {group.assets.map((asset) => {
                  const loan = activeLoan(asset);

                  return (
                    <div
                      key={asset.id}
                      className="vgc-surface rounded-xl border border-zinc-800 bg-zinc-950 p-4"
                    >
                      <div className="flex gap-4">
                        <img
                          src={qrUrlForAsset(asset.tag)}
                          alt={`QR code for ${asset.tag}`}
                          className="h-24 w-24 rounded bg-white p-1"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="text-xs text-zinc-400">Asset Tag</div>
                          <a
                            href={`/assets/${encodeURIComponent(asset.tag)}`}
                            className="vgc-accent-text font-mono text-lg font-bold hover:opacity-80"
                          >
                            {asset.tag}
                          </a>
                          <h3 className="mt-1 font-semibold">
                            {assetTitle(asset)}
                          </h3>
                          <p className="vgc-muted text-sm text-zinc-400">
                            {assetSubtitle(asset)}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 rounded-lg bg-zinc-900 p-3 text-sm">
                        {loan ? (
                          <div>
                            <div className="font-semibold text-red-300">
                              Checked out
                            </div>
                            <div className="vgc-muted text-zinc-400">
                              Borrower: {loan.borrowerName}
                            </div>
                            {loan.dueAt && (
                              <div className="vgc-muted text-zinc-400">
                                Due: {new Date(loan.dueAt).toLocaleDateString()}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="font-semibold text-green-300">
                            Available
                          </div>
                        )}
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-2">
                        {loan ? (
                          <Button type="button" onClick={() => checkin(asset)}>
                            Check in
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            onClick={() => setSelectedAsset(asset)}
                          >
                            Check out
                          </Button>
                        )}

                        <a
                          className="rounded-xl border border-zinc-700 px-4 py-2 text-center text-sm font-semibold hover:bg-zinc-800"
                          href={`/assets/${encodeURIComponent(asset.tag)}`}
                        >
                          Details
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        {filteredAssets.length === 0 && (
          <p className="rounded-xl border border-dashed border-zinc-700 p-8 text-center text-zinc-400">
            No asset tags found. Create one for a game, system, peripheral, or
            toys-to-life item.
          </p>
        )}
      </Card>

      {showCreateTag && (
        <Modal title="Create Asset Tag" onClose={() => setShowCreateTag(false)}>
          <form onSubmit={createTag} className="space-y-3">
            <Input
              placeholder="Asset tag"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
            />

            <select
              className="vgc-select"
              style={{ colorScheme: "light" }}
              value={assetType}
              onChange={async (e) => {
                const nextType = e.target.value as AssetCreateType;
                setAssetType(nextType);
                await generateNextTag(nextType);
              }}
            >
              {assetTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>

            <select
              className="vgc-select"
              style={{ colorScheme: "light" }}
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
            >
              {filteredTargets.map((target) => (
                <option key={target.id} value={target.id}>
                  {"game" in target
                    ? `${target.game.title} · ${target.collection.name}`
                    : `${target.name} · ${target.collection.name}`}
                </option>
              ))}
            </select>

            {filteredTargets.length === 0 && (
              <p className="rounded-lg bg-amber-950 p-3 text-sm text-amber-100">
                No untagged {typeLabel(assetType).toLowerCase()} assets are
                available. Add one to a collection first, or remove an existing
                asset tag.
              </p>
            )}

            <textarea
              className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 outline-none ring-indigo-500 focus:ring-2"
              placeholder="Tag notes"
              value={tagNotes}
              onChange={(e) => setTagNotes(e.target.value)}
              rows={3}
            />

            <div className="grid grid-cols-2 gap-2">
              <Button type="submit" disabled={!targetId || !newTag}>
                Create tag
              </Button>
              <Button type="button" onClick={() => setShowCreateTag(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {selectedAsset && (
        <Modal
          title={`Check out ${selectedAsset.tag}`}
          onClose={() => setSelectedAsset(null)}
        >
          <form onSubmit={checkout} className="space-y-3">
            <div>
              <div className="font-semibold">{assetTitle(selectedAsset)}</div>
              <div className="vgc-muted text-sm text-zinc-400">
                {assetSubtitle(selectedAsset)}
              </div>
            </div>

            <Input
              placeholder="Borrower name"
              value={borrowerName}
              onChange={(e) => setBorrowerName(e.target.value)}
            />
            <Input
              placeholder="Borrower email"
              value={borrowerEmail}
              onChange={(e) => setBorrowerEmail(e.target.value)}
            />
            <Input
              type="date"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
            />

            <textarea
              className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 outline-none ring-indigo-500 focus:ring-2"
              placeholder="Checkout notes"
              value={checkoutNotes}
              onChange={(e) => setCheckoutNotes(e.target.value)}
              rows={4}
            />

            <div className="grid grid-cols-2 gap-2">
              <Button type="submit">Check out</Button>
              <Button type="button" onClick={() => setSelectedAsset(null)}>
                Cancel
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </Shell>
  );
}
