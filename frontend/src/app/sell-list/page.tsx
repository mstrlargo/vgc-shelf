"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { Shell } from "@/components/Shell";
import { CircleDollarSign, History, Pencil, Tag, Trash2, X } from "lucide-react";

type SellListItem = {
  id: string;
  sourceType: "MANUAL" | "GAME_COPY" | "COLLECTION_ITEM";
  sourceId?: string | null;
  title: string;
  platform?: string | null;
  category: "GAME" | "SYSTEM" | "PERIPHERAL" | "TOYS_TO_LIFE";
  askingPrice?: string | null;
  currentValue?: string | null;
  soldPrice?: string | null;
  soldAt?: string | null;
  sourceRemovedAt?: string | null;
  status: "AVAILABLE" | "SOLD" | "HOLD";
  notes?: string | null;
  imageUrl?: string | null;
  assetTag?: string | null;
  collectionName?: string | null;
  createdAt: string;
  updatedAt: string;
};

type SaleForm = {
  title: string;
  soldPrice: string;
  soldAt: string;
  notes: string;
};

const sortOptions = [
  ["newest", "Date added: newest"],
  ["oldest", "Date added: oldest"],
  ["name", "Name A-Z"],
  ["name-desc", "Name Z-A"],
  ["status", "Status"],
  ["asking-price", "Asking price: low to high"],
  ["asking-price-desc", "Asking price: high to low"],
  ["current-value", "Current value: low to high"],
  ["current-value-desc", "Current value: high to low"]
];

function money(value: string | number | null | undefined) {
  if (value === null || typeof value === "undefined" || value === "") return "—";

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(Number(value));
}

function inputDate(value?: string | null) {
  if (!value) {
    const now = new Date();
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  }

  return new Date(value).toISOString().slice(0, 10);
}

function displayDate(value?: string | null) {
  if (!value) return "Unknown date";

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC"
  }).format(new Date(value));
}

function saleDate(value: string) {
  return `${value}T12:00:00.000Z`;
}

export default function SellListPage() {
  const [items, setItems] = useState<SellListItem[]>([]);
  const [sort, setSort] = useState("newest");
  const [message, setMessage] = useState("");
  const [working, setWorking] = useState(false);
  const [completingItem, setCompletingItem] = useState<SellListItem | null>(null);
  const [editingHistory, setEditingHistory] = useState<SellListItem | null>(null);
  const [form, setForm] = useState<SaleForm>({ title: "", soldPrice: "", soldAt: "", notes: "" });

  const activeItems = useMemo(() => items.filter((item) => item.status !== "SOLD"), [items]);
  const soldItems = useMemo(
    () =>
      items
        .filter((item) => item.status === "SOLD")
        .sort((a, b) => new Date(b.soldAt || b.updatedAt).getTime() - new Date(a.soldAt || a.updatedAt).getTime()),
    [items]
  );
  const askingTotal = useMemo(
    () => activeItems.reduce((total, item) => total + Number(item.askingPrice || 0), 0),
    [activeItems]
  );
  const soldTotal = useMemo(
    () => soldItems.reduce((total, item) => total + Number(item.soldPrice || item.askingPrice || 0), 0),
    [soldItems]
  );

  async function load(nextSort = sort) {
    setMessage("");

    try {
      const data = await api<{ items: SellListItem[] }>(`/lists/sell-list?sort=${nextSort}`);
      setItems(data.items);
    } catch (err: any) {
      setMessage(err.message || "Failed to load sell list.");
    }
  }

  async function updateStatus(item: SellListItem, status: "AVAILABLE" | "HOLD") {
    setMessage("");

    try {
      await api(`/lists/sell-list/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status })
      });

      await load();
      setMessage("Sell list status updated.");
    } catch (err: any) {
      setMessage(err.message || "Failed to update status.");
    }
  }

  async function removeItem(item: SellListItem) {
    const label = item.status === "SOLD" ? "sale history entry" : "sell list item";
    if (!confirm(`Permanently remove this ${label}?`)) return;

    setMessage("");

    try {
      await api(`/lists/sell-list/${item.id}`, { method: "DELETE" });
      await load();
      setMessage(item.status === "SOLD" ? "Sale history entry removed." : "Sell list item removed.");
    } catch (err: any) {
      setMessage(err.message || `Failed to remove ${label}.`);
    }
  }

  function openCompleteSale(item: SellListItem) {
    setCompletingItem(item);
    setEditingHistory(null);
    setForm({
      title: item.title,
      soldPrice: item.soldPrice || item.askingPrice || "",
      soldAt: inputDate(item.soldAt),
      notes: item.notes || ""
    });
  }

  function openHistoryEditor(item: SellListItem) {
    setEditingHistory(item);
    setCompletingItem(null);
    setForm({
      title: item.title,
      soldPrice: item.soldPrice || item.askingPrice || "",
      soldAt: inputDate(item.soldAt || item.updatedAt),
      notes: item.notes || ""
    });
  }

  function closeEditor() {
    if (working) return;
    setCompletingItem(null);
    setEditingHistory(null);
  }

  async function completeSale(event: FormEvent) {
    event.preventDefault();
    if (!completingItem) return;

    setWorking(true);
    setMessage("");

    try {
      const result = await api<{ item: SellListItem; removedFromCollection: boolean }>(
        `/lists/sell-list/${completingItem.id}/complete-sale`,
        {
          method: "POST",
          body: JSON.stringify({
            soldPrice: form.soldPrice.trim() || null,
            soldAt: saleDate(form.soldAt),
            notes: form.notes.trim() || null
          })
        }
      );

      await load();
      setCompletingItem(null);
      setMessage(
        result.removedFromCollection
          ? `${completingItem.title} was sold, removed from its collection, and added to sale history.`
          : `${completingItem.title} was added to sale history.`
      );
    } catch (err: any) {
      setMessage(err.message || "Failed to complete sale.");
    } finally {
      setWorking(false);
    }
  }

  async function saveHistory(event: FormEvent) {
    event.preventDefault();
    if (!editingHistory) return;

    setWorking(true);
    setMessage("");

    try {
      await api(`/lists/sell-list/${editingHistory.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: form.title.trim(),
          soldPrice: form.soldPrice.trim() || null,
          soldAt: saleDate(form.soldAt),
          notes: form.notes.trim() || null
        })
      });

      await load();
      setEditingHistory(null);
      setMessage("Sale history updated.");
    } catch (err: any) {
      setMessage(err.message || "Failed to update sale history.");
    } finally {
      setWorking(false);
    }
  }

  async function finishLegacySale(item: SellListItem) {
    if (!confirm(`Remove ${item.title} from its collection and keep this sale history entry?`)) return;

    setWorking(true);
    setMessage("");

    try {
      const result = await api<{ removedFromCollection: boolean }>(`/lists/sell-list/${item.id}/complete-sale`, {
        method: "POST",
        body: JSON.stringify({
          soldPrice: item.soldPrice || item.askingPrice || null,
          soldAt: item.soldAt || item.updatedAt,
          notes: item.notes || null
        })
      });

      await load();
      setMessage(
        result.removedFromCollection
          ? `${item.title} was removed from its collection.`
          : `${item.title} was already absent from its collection.`
      );
    } catch (err: any) {
      setMessage(err.message || "Failed to remove the sold item from its collection.");
    } finally {
      setWorking(false);
    }
  }

  function changeSort(value: string) {
    setSort(value);
    load(value);
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <Shell>
      <div className="space-y-6">
        <Card>
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="flex items-start gap-3">
              <Tag className="mt-1 h-6 w-6 vgc-accent-text" />
              <div>
                <h2 className="text-xl font-bold">Sell List</h2>
                <p className="vgc-muted text-sm text-zinc-400">
                  Complete a sale to remove the item from its collection and preserve it in your sale history.
                </p>
              </div>
            </div>

            <label className="block md:w-72">
              <span className="mb-1 block text-sm font-medium">Sort active items</span>
              <select
                className="vgc-select"
                style={{ colorScheme: "light" }}
                value={sort}
                onChange={(event) => changeSort(event.target.value)}
              >
                {sortOptions.map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
              <p className="vgc-muted text-sm">Active listings</p>
              <p className="mt-1 text-2xl font-bold">{activeItems.length}</p>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
              <p className="vgc-muted text-sm">Active asking total</p>
              <p className="mt-1 text-2xl font-bold">{money(askingTotal)}</p>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
              <p className="vgc-muted text-sm">Recorded sales</p>
              <p className="mt-1 text-2xl font-bold">{money(soldTotal)}</p>
            </div>
          </div>

          {message && <p className="mt-4 rounded-lg bg-zinc-800 p-3 text-sm">{message}</p>}
        </Card>

        <Card>
          <div>
            <h2 className="text-xl font-bold">Items for Sale</h2>
            <p className="vgc-muted text-sm text-zinc-400">{activeItems.length} active items</p>
          </div>

          <div className="mt-5 grid gap-4">
            {activeItems.map((item) => (
              <div key={item.id} className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="text-xs uppercase tracking-wide text-zinc-500">{item.category.replaceAll("_", " ")}</div>
                    <h3 className="text-lg font-bold">{item.title}</h3>
                    <p className="vgc-muted text-sm text-zinc-400">
                      {item.platform || "Unknown platform"} · {item.collectionName || "Collection"}
                    </p>
                    {item.assetTag && <p className="mt-1 font-mono text-sm vgc-accent-text">{item.assetTag}</p>}
                    <p className="mt-2 text-sm">Asking: {money(item.askingPrice)} · Current: {money(item.currentValue)}</p>
                    {item.notes && <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-300">{item.notes}</p>}
                  </div>
                  {item.imageUrl && <img src={item.imageUrl} alt="" className="h-24 w-24 rounded-lg object-cover" />}
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
                  <select
                    className="vgc-select"
                    style={{ colorScheme: "light" }}
                    value={item.status}
                    onChange={(event) => updateStatus(item, event.target.value as "AVAILABLE" | "HOLD")}
                  >
                    <option value="AVAILABLE">Available</option>
                    <option value="HOLD">Hold</option>
                  </select>
                  <Button type="button" onClick={() => openCompleteSale(item)}>
                    <CircleDollarSign className="mr-2 h-4 w-4" /> Complete sale
                  </Button>
                  <button
                    type="button"
                    onClick={() => removeItem(item)}
                    className="inline-flex min-h-11 items-center justify-center rounded-xl border border-red-800 px-4 py-2 text-sm font-semibold text-red-300 hover:bg-red-950"
                    aria-label="Remove from Sell List"
                    title="Remove from Sell List"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}

            {activeItems.length === 0 && (
              <p className="rounded-xl border border-dashed border-zinc-700 p-8 text-center text-zinc-400">
                No active sell list items. Add items from inside a collection.
              </p>
            )}
          </div>
        </Card>

        <Card>
          <div className="flex items-start gap-3">
            <History className="mt-1 h-6 w-6 vgc-accent-text" />
            <div>
              <h2 className="text-xl font-bold">Sold History</h2>
              <p className="vgc-muted text-sm text-zinc-400">{soldItems.length} completed sales</p>
            </div>
          </div>

          <div className="mt-5 grid gap-4">
            {soldItems.map((item) => (
              <div key={item.id} className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="text-xs uppercase tracking-wide text-zinc-500">
                      Sold {displayDate(item.soldAt || item.updatedAt)}
                    </div>
                    <h3 className="text-lg font-bold">{item.title}</h3>
                    <p className="vgc-muted text-sm text-zinc-400">
                      {item.platform || "Unknown platform"} · {item.collectionName || "Collection"}
                    </p>
                    {item.assetTag && <p className="mt-1 font-mono text-sm vgc-accent-text">{item.assetTag}</p>}
                    <p className="mt-2 text-sm">
                      Sold for: <span className="font-semibold">{money(item.soldPrice || item.askingPrice)}</span> · Asking: {money(item.askingPrice)} · Value: {money(item.currentValue)}
                    </p>
                    {item.notes && <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-300">{item.notes}</p>}
                    {!item.sourceRemovedAt && item.sourceType !== "MANUAL" && (
                      <p className="mt-3 rounded-lg border border-amber-800 bg-amber-950/40 p-3 text-sm text-amber-200">
                        This entry was marked sold before automatic collection removal was enabled.
                      </p>
                    )}
                  </div>
                  {item.imageUrl && <img src={item.imageUrl} alt="" className="h-24 w-24 rounded-lg object-cover" />}
                </div>

                <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
                  {!item.sourceRemovedAt && item.sourceType !== "MANUAL" && (
                    <Button type="button" disabled={working} onClick={() => finishLegacySale(item)}>
                      Remove from collection
                    </Button>
                  )}
                  <button
                    type="button"
                    onClick={() => openHistoryEditor(item)}
                    className="inline-flex min-h-11 items-center justify-center rounded-xl border border-zinc-700 px-4 py-2 text-sm font-semibold hover:bg-zinc-800"
                  >
                    <Pencil className="mr-2 h-4 w-4" /> Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => removeItem(item)}
                    className="inline-flex min-h-11 items-center justify-center rounded-xl border border-red-800 px-4 py-2 text-sm font-semibold text-red-300 hover:bg-red-950"
                  >
                    <Trash2 className="mr-2 h-4 w-4" /> Delete history
                  </button>
                </div>
              </div>
            ))}

            {soldItems.length === 0 && (
              <p className="rounded-xl border border-dashed border-zinc-700 p-8 text-center text-zinc-400">
                Completed sales will appear here.
              </p>
            )}
          </div>
        </Card>
      </div>

      {(completingItem || editingHistory) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <form
            onSubmit={completingItem ? completeSale : saveHistory}
            role="dialog"
            aria-modal="true"
            aria-labelledby="sale-editor-title"
            className="vgc-surface max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="sale-editor-title" className="text-xl font-bold">{completingItem ? "Complete Sale" : "Edit Sale History"}</h2>
                <p className="vgc-muted mt-1 text-sm text-zinc-400">
                  {completingItem
                    ? "Completing this sale removes the original item from its collection and saves this history record."
                    : "Changes affect the history record only."}
                </p>
              </div>
              <button type="button" onClick={closeEditor} className="rounded-lg border border-zinc-700 p-2 hover:bg-zinc-800" aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-6 grid gap-4">
              {editingHistory && (
                <label>
                  <span className="mb-1 block text-sm font-medium">Item title</span>
                  <Input required maxLength={200} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
                </label>
              )}
              <label>
                <span className="mb-1 block text-sm font-medium">Sold price</span>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={form.soldPrice}
                  onChange={(event) => setForm({ ...form, soldPrice: event.target.value })}
                />
              </label>
              <label>
                <span className="mb-1 block text-sm font-medium">Date sold</span>
                <Input type="date" required value={form.soldAt} onChange={(event) => setForm({ ...form, soldAt: event.target.value })} />
              </label>
              <label>
                <span className="mb-1 block text-sm font-medium">Notes</span>
                <textarea
                  className="min-h-32 w-full resize-y rounded-xl border border-zinc-700 bg-white px-4 py-3 text-base text-zinc-950 outline-none ring-indigo-500 focus:ring-2 sm:text-sm"
                  value={form.notes}
                  onChange={(event) => setForm({ ...form, notes: event.target.value })}
                />
              </label>
            </div>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button type="button" disabled={working} onClick={closeEditor} className="min-h-11 rounded-xl border border-zinc-700 px-5 py-2 text-sm font-semibold hover:bg-zinc-800">
                Cancel
              </button>
              <Button type="submit" disabled={working}>
                {working ? "Saving…" : completingItem ? "Complete sale" : "Save changes"}
              </Button>
            </div>
          </form>
        </div>
      )}
    </Shell>
  );
}
