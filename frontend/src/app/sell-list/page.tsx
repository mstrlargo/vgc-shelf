"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Shell } from "@/components/Shell";
import { Tag, Trash2 } from "lucide-react";

type SellListItem = {
  id: string;
  title: string;
  platform?: string | null;
  category: "GAME" | "SYSTEM" | "PERIPHERAL" | "TOYS_TO_LIFE";
  askingPrice?: string | null;
  currentValue?: string | null;
  status: "AVAILABLE" | "SOLD" | "HOLD";
  notes?: string | null;
  imageUrl?: string | null;
  assetTag?: string | null;
  collectionName?: string | null;
  createdAt: string;
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

export default function SellListPage() {
  const [items, setItems] = useState<SellListItem[]>([]);
  const [sort, setSort] = useState("newest");
  const [message, setMessage] = useState("");

  async function load(nextSort = sort) {
    setMessage("");

    try {
      const data = await api<{ items: SellListItem[] }>(`/lists/sell-list?sort=${nextSort}`);
      setItems(data.items);
    } catch (err: any) {
      setMessage(err.message || "Failed to load sell list.");
    }
  }

  async function updateStatus(item: SellListItem, status: SellListItem["status"]) {
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

  async function removeItem(id: string) {
    setMessage("");

    try {
      await api(`/lists/sell-list/${id}`, {
        method: "DELETE"
      });

      await load();
      setMessage("Sell list item removed.");
    } catch (err: any) {
      setMessage(err.message || "Failed to remove sell list item.");
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
                  Items listed here must be added from a collection item or game.
                </p>
              </div>
            </div>

            <label className="block md:w-72">
              <span className="mb-1 block text-sm font-medium">Sort</span>

              <select
                className="vgc-select"
                style={{ colorScheme: "light" }}
                value={sort}
                onChange={(e) => changeSort(e.target.value)}
              >
                {sortOptions.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {message && <p className="mt-4 rounded-lg bg-zinc-800 p-3 text-sm">{message}</p>}
        </Card>

        <Card>
          <div>
            <h2 className="text-xl font-bold">Sell List Items</h2>
            <p className="vgc-muted text-sm text-zinc-400">{items.length} items</p>
          </div>

          <div className="mt-5 grid gap-4">
            {items.map((item) => (
              <div key={item.id} className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="text-xs uppercase tracking-wide text-zinc-500">
                      {item.category.replaceAll("_", " ")}
                    </div>

                    <h3 className="text-lg font-bold">{item.title}</h3>

                    <p className="vgc-muted text-sm text-zinc-400">
                      {item.platform || "Unknown platform"} · {item.collectionName || "Collection"} · {item.status}
                    </p>

                    {item.assetTag && <p className="mt-1 font-mono text-sm vgc-accent-text">{item.assetTag}</p>}

                    <p className="mt-1 text-sm">
                      Asking: {money(item.askingPrice)} · Current: {money(item.currentValue)}
                    </p>

                    {item.notes && <p className="mt-2 text-sm text-zinc-300">{item.notes}</p>}
                  </div>

                  {item.imageUrl && <img src={item.imageUrl} alt="" className="h-24 w-24 rounded-lg object-cover" />}
                </div>

                <div className="mt-4 grid gap-2 md:grid-cols-[1fr_auto_auto]">
                  <select
                    className="vgc-select"
                    style={{ colorScheme: "light" }}
                    value={item.status}
                    onChange={(e) => updateStatus(item, e.target.value as SellListItem["status"])}
                  >
                    <option value="AVAILABLE">Available</option>
                    <option value="HOLD">Hold</option>
                    <option value="SOLD">Sold</option>
                  </select>

                  <Button type="button" onClick={() => updateStatus(item, "SOLD")}>
                    Mark sold
                  </Button>

                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    className="rounded-xl border border-red-800 px-4 py-2 text-sm font-semibold text-red-300 hover:bg-red-950"
                    aria-label="Remove from Sell List"
                    title="Remove from Sell List"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}

            {items.length === 0 && (
              <p className="rounded-xl border border-dashed border-zinc-700 p-8 text-center text-zinc-400">
                No sell list items yet. Add items from inside a collection.
              </p>
            )}
          </div>
        </Card>
      </div>
    </Shell>
  );
}
