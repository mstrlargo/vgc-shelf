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
import { api, CollectionItem, CollectionType, GameCopy, User } from "@/lib/api";
import { Branding, loadBranding } from "@/lib/branding";
import { printAssetLabels } from "@/components/SmallAssetLabel";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { Modal } from "@/components/Modal";
import { Shell } from "@/components/Shell";
import { AlertTriangle, CheckSquare, Plus, Printer, Search, Square } from "lucide-react";

type EligibleCopy = GameCopy & {
  collection: { id: string; name: string; type: CollectionType };
};
type EligibleItem = CollectionItem & {
  collection: { id: string; name: string; type: CollectionType };
};
type AssetCreateType = "GAMES" | "SYSTEMS" | "PERIPHERALS" | "TOYS_TO_LIFE";
type AvailabilityFilter = "ALL" | "AVAILABLE" | "CHECKED_OUT";
type LabelFilter = "ALL" | "NORMAL" | "MISSING" | "DAMAGED";
type LabelStatus = "NORMAL" | "MISSING" | "DAMAGED";

const assetTypes: Array<{ value: AssetCreateType; label: string }> = [
  { value: "GAMES", label: "Game" },
  { value: "SYSTEMS", label: "System" },
  { value: "PERIPHERALS", label: "Peripheral" },
  { value: "TOYS_TO_LIFE", label: "Toys-to-life" },
];

function typeLabel(type: AssetCreateType) {
  return assetTypes.find((assetType) => assetType.value === type)?.label || type;
}

function assetCollection(asset: AssetTag) {
  const collection = asset.gameCopy?.collection || asset.collectionItem?.collection || null;

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

function labelStatusText(status?: LabelStatus) {
  if (status === "MISSING") return "Label missing";
  if (status === "DAMAGED") return "Label damaged";
  return "Label good";
}

export default function AssetsPage() {
  const [assets, setAssets] = useState<AssetTag[]>([]);
  const [eligibleCopies, setEligibleCopies] = useState<EligibleCopy[]>([]);
  const [eligibleItems, setEligibleItems] = useState<EligibleItem[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [branding, setBranding] = useState<Branding>({
    appName: "VGC Shelf",
    pageTitle: "VGC Shelf",
    appIconUrl: null,
  });
  const [query, setQuery] = useState("");
  const [availabilityFilter, setAvailabilityFilter] = useState<AvailabilityFilter>("ALL");
  const [labelFilter, setLabelFilter] = useState<LabelFilter>("ALL");
  const [message, setMessage] = useState("");
  const [selectedAsset, setSelectedAsset] = useState<AssetTag | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
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
    const [assetData, eligibleData, meData, brandingData] = await Promise.all([
      getAssets(),
      api<{ gameCopies: EligibleCopy[]; collectionItems: EligibleItem[] }>("/assets/eligible"),
      api<{ user: User }>("/auth/me").catch(() => ({ user: null as unknown as User })),
      loadBranding(),
    ]);

    setAssets(assetData.assets);
    setEligibleCopies(eligibleData.gameCopies);
    setEligibleItems(eligibleData.collectionItems);
    setUser(meData.user);
    setBranding(brandingData);
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
        body: JSON.stringify({ returnNotes: returnNotes || null }),
      });

      setReturnNotes("");
      setMessage("Asset checked in.");
      await load();
    } catch (err: any) {
      setMessage(err.message || "Failed to check in asset.");
    }
  }

  async function updateLabelStatus(asset: AssetTag, status: LabelStatus) {
    setMessage("");

    try {
      await api(`/assets/${asset.id}/label-status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setMessage(status === "NORMAL" ? "Label marked as good." : `Label marked ${status.toLowerCase()}.`);
      await load();
    } catch (err: any) {
      setMessage(err.message || "Failed to update label status.");
    }
  }

  async function printAssets(assetList: AssetTag[]) {
    if (assetList.length === 0) return;

    const opened = printAssetLabels({ assetTags: assetList, user, branding });
    if (!opened) {
      setMessage("The print window was blocked. Allow pop-ups and try again.");
      return;
    }

    try {
      await api("/assets/labels/printed", {
        method: "POST",
        body: JSON.stringify({ assetIds: assetList.map((asset) => asset.id) }),
      });
      setSelectedIds(new Set());
      setMessage(`${assetList.length} label${assetList.length === 1 ? "" : "s"} opened for printing.`);
      await load();
    } catch (err: any) {
      setMessage(err.message || "Labels opened, but print status could not be updated.");
    }
  }

  function toggleSelected(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const filteredAssets = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return assets.filter((asset) => {
      const loan = activeLoan(asset);
      const availabilityMatches =
        availabilityFilter === "ALL" ||
        (availabilityFilter === "AVAILABLE" && !loan) ||
        (availabilityFilter === "CHECKED_OUT" && !!loan);
      const status = asset.labelStatus || "NORMAL";
      const labelMatches = labelFilter === "ALL" || status === labelFilter;
      const haystack = `${asset.tag} ${assetTitle(asset)} ${assetSubtitle(asset)} ${loan?.borrowerName || ""} ${loan?.borrowerEmail || ""}`.toLowerCase();
      const queryMatches = !normalizedQuery || haystack.includes(normalizedQuery);
      return availabilityMatches && labelMatches && queryMatches;
    });
  }, [assets, availabilityFilter, labelFilter, query]);

  const groupedAssets = useMemo(() => {
    const groups = new Map<string, { id: string; name: string; assets: AssetTag[] }>();

    for (const asset of filteredAssets) {
      const collection = assetCollection(asset);
      if (!groups.has(collection.id)) {
        groups.set(collection.id, { id: collection.id, name: collection.name, assets: [] });
      }
      groups.get(collection.id)!.assets.push(asset);
    }

    return Array.from(groups.values())
      .map((group) => ({ ...group, assets: group.assets.sort(sortAssetTags) }))
      .sort((left, right) => {
        if (left.id === "unassigned") return 1;
        if (right.id === "unassigned") return -1;
        return left.name.localeCompare(right.name, undefined, { numeric: true, sensitivity: "base" });
      });
  }, [filteredAssets]);

  const selectedAssets = useMemo(
    () => assets.filter((asset) => selectedIds.has(asset.id)),
    [assets, selectedIds],
  );

  const allFilteredSelected = filteredAssets.length > 0 && filteredAssets.every((asset) => selectedIds.has(asset.id));

  useEffect(() => {
    load().catch((err) => setMessage(err.message));
  }, []);

  useEffect(() => {
    if (!showCreateTag) return;
    setTargetId(filteredTargets[0]?.id || "");
  }, [assetType, filteredTargets, showCreateTag]);

  return (
    <Shell>
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-3xl font-bold">Asset Tags & Lending</h2>
          <p className="vgc-muted text-sm text-zinc-400">
            Print labels in bulk, track damaged labels, check items out, and manage returns.
          </p>
        </div>

        <Button type="button" onClick={openCreateTag}>
          <Plus className="mr-2 h-4 w-4" />
          Create asset tag
        </Button>
      </div>

      {message && <p className="mb-6 rounded-lg bg-zinc-800 p-3 text-sm">{message}</p>}

      <Card>
        <div className="mb-5 grid gap-3 lg:grid-cols-[1fr_auto_auto]">
          <div className="flex items-center gap-2">
            <Search className="h-5 w-5 vgc-accent-text" />
            <Input
              placeholder="Search by tag, title, collection, or borrower"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <select className="vgc-select" value={availabilityFilter} onChange={(e) => setAvailabilityFilter(e.target.value as AvailabilityFilter)}>
            <option value="ALL">All availability</option>
            <option value="AVAILABLE">Available</option>
            <option value="CHECKED_OUT">Checked out</option>
          </select>

          <select className="vgc-select" value={labelFilter} onChange={(e) => setLabelFilter(e.target.value as LabelFilter)}>
            <option value="ALL">All label conditions</option>
            <option value="NORMAL">Label good</option>
            <option value="MISSING">Label missing</option>
            <option value="DAMAGED">Label damaged</option>
          </select>
        </div>

        <div className="mb-6 flex flex-wrap items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950 p-3">
          <button
            type="button"
            className="flex items-center gap-2 rounded-lg border border-zinc-700 px-3 py-2 text-sm hover:bg-zinc-800"
            onClick={() => {
              if (allFilteredSelected) setSelectedIds(new Set());
              else setSelectedIds(new Set(filteredAssets.map((asset) => asset.id)));
            }}
          >
            {allFilteredSelected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
            Select filtered
          </button>

          <Button type="button" disabled={selectedAssets.length === 0} onClick={() => printAssets(selectedAssets)}>
            <Printer className="mr-2 h-4 w-4" />
            Print selected ({selectedAssets.length})
          </Button>

          <span className="vgc-muted text-sm text-zinc-400">
            Printing a missing or damaged label automatically marks it as good.
          </span>
        </div>

        <div className="space-y-8">
          {groupedAssets.map((group) => (
            <section key={group.id} className="space-y-4">
              <div className="flex flex-col gap-3 border-b border-zinc-800 pb-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-xl font-bold">{group.name}</h3>
                  <p className="vgc-muted text-sm text-zinc-400">
                    {group.assets.length} asset{group.assets.length === 1 ? "" : "s"}
                  </p>
                </div>
                <button
                  type="button"
                  className="flex items-center justify-center gap-2 rounded-xl border border-zinc-700 px-4 py-2 text-sm font-semibold hover:bg-zinc-800"
                  onClick={() => printAssets(group.assets)}
                >
                  <Printer className="h-4 w-4" />
                  Print collection labels
                </button>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {group.assets.map((asset) => {
                  const loan = activeLoan(asset);
                  const labelStatus = asset.labelStatus || "NORMAL";
                  const selected = selectedIds.has(asset.id);

                  return (
                    <div key={asset.id} className={`vgc-surface rounded-xl border bg-zinc-950 p-4 ${selected ? "border-indigo-400" : "border-zinc-800"}`}>
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <button type="button" className="flex items-center gap-2 text-sm" onClick={() => toggleSelected(asset.id)}>
                          {selected ? <CheckSquare className="h-5 w-5 vgc-accent-text" /> : <Square className="h-5 w-5" />}
                          Select label
                        </button>
                        {labelStatus !== "NORMAL" && (
                          <span className="flex items-center gap-1 rounded-full bg-amber-950 px-2 py-1 text-xs text-amber-200">
                            <AlertTriangle className="h-3 w-3" />
                            {labelStatusText(labelStatus)}
                          </span>
                        )}
                      </div>

                      <div className="flex gap-4">
                        <img src={qrUrlForAsset(asset.tag)} alt={`QR code for ${asset.tag}`} className="h-24 w-24 rounded bg-white p-1" />
                        <div className="min-w-0 flex-1">
                          <div className="text-xs text-zinc-400">Asset Tag</div>
                          <a href={`/assets/${encodeURIComponent(asset.tag)}`} className="vgc-accent-text font-mono text-lg font-bold hover:opacity-80">
                            {asset.tag}
                          </a>
                          <h3 className="mt-1 font-semibold">{assetTitle(asset)}</h3>
                          <p className="vgc-muted text-sm text-zinc-400">{assetSubtitle(asset)}</p>
                        </div>
                      </div>

                      <div className="mt-4 rounded-lg bg-zinc-900 p-3 text-sm">
                        {loan ? (
                          <div>
                            <div className="font-semibold text-red-300">Checked out</div>
                            <div className="vgc-muted text-zinc-400">Borrower: {loan.borrowerName}</div>
                            {loan.dueAt && <div className="vgc-muted text-zinc-400">Due: {new Date(loan.dueAt).toLocaleDateString()}</div>}
                          </div>
                        ) : (
                          <div className="font-semibold text-green-300">Available</div>
                        )}
                      </div>

                      <div className="mt-4 grid gap-2 sm:grid-cols-2">
                        <select
                          className="vgc-select"
                          value={labelStatus}
                          onChange={(e) => updateLabelStatus(asset, e.target.value as LabelStatus)}
                          aria-label={`Label condition for ${asset.tag}`}
                        >
                          <option value="NORMAL">Label good</option>
                          <option value="MISSING">Label missing</option>
                          <option value="DAMAGED">Label damaged</option>
                        </select>
                        <button type="button" className="flex items-center justify-center gap-2 rounded-xl border border-zinc-700 px-4 py-2 text-sm font-semibold hover:bg-zinc-800" onClick={() => printAssets([asset])}>
                          <Printer className="h-4 w-4" />
                          Reprint label
                        </button>
                      </div>

                      <div className="mt-2 grid grid-cols-2 gap-2">
                        {loan ? (
                          <Button type="button" onClick={() => checkin(asset)}>Check in</Button>
                        ) : (
                          <Button type="button" onClick={() => setSelectedAsset(asset)}>Check out</Button>
                        )}
                        <a className="rounded-xl border border-zinc-700 px-4 py-2 text-center text-sm font-semibold hover:bg-zinc-800" href={`/assets/${encodeURIComponent(asset.tag)}`}>
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
            No asset tags match the current search and filters.
          </p>
        )}
      </Card>

      {showCreateTag && (
        <Modal title="Create Asset Tag" onClose={() => setShowCreateTag(false)}>
          <form onSubmit={createTag} className="space-y-3">
            <Input placeholder="Asset tag" value={newTag} onChange={(e) => setNewTag(e.target.value)} />

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
              {assetTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
            </select>

            <select className="vgc-select" style={{ colorScheme: "light" }} value={targetId} onChange={(e) => setTargetId(e.target.value)}>
              {filteredTargets.map((target) => (
                <option key={target.id} value={target.id}>
                  {"game" in target ? `${target.game.title} · ${target.collection.name}` : `${target.name} · ${target.collection.name}`}
                </option>
              ))}
            </select>

            {filteredTargets.length === 0 && (
              <p className="rounded-lg bg-amber-950 p-3 text-sm text-amber-100">
                No untagged {typeLabel(assetType).toLowerCase()} assets are available. Add one to a collection first, or remove an existing asset tag.
              </p>
            )}

            <textarea className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 outline-none ring-indigo-500 focus:ring-2" placeholder="Tag notes" value={tagNotes} onChange={(e) => setTagNotes(e.target.value)} rows={3} />

            <div className="grid grid-cols-2 gap-2">
              <Button type="submit" disabled={!targetId || !newTag}>Create tag</Button>
              <Button type="button" onClick={() => setShowCreateTag(false)}>Cancel</Button>
            </div>
          </form>
        </Modal>
      )}

      {selectedAsset && (
        <Modal title={`Check out ${selectedAsset.tag}`} onClose={() => setSelectedAsset(null)}>
          <form onSubmit={checkout} className="space-y-3">
            <div>
              <div className="font-semibold">{assetTitle(selectedAsset)}</div>
              <div className="vgc-muted text-sm text-zinc-400">{assetSubtitle(selectedAsset)}</div>
            </div>

            <Input placeholder="Borrower name" value={borrowerName} onChange={(e) => setBorrowerName(e.target.value)} />
            <Input placeholder="Borrower email" value={borrowerEmail} onChange={(e) => setBorrowerEmail(e.target.value)} />
            <Input type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />

            <textarea className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 outline-none ring-indigo-500 focus:ring-2" placeholder="Checkout notes" value={checkoutNotes} onChange={(e) => setCheckoutNotes(e.target.value)} rows={4} />

            <div className="grid grid-cols-2 gap-2">
              <Button type="submit">Check out</Button>
              <Button type="button" onClick={() => setSelectedAsset(null)}>Cancel</Button>
            </div>
          </form>
        </Modal>
      )}
    </Shell>
  );
}
