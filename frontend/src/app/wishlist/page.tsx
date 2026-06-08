"use client";

import { useEffect, useState } from "react";
import { api, Collection, MetadataResult } from "@/lib/api";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { Shell } from "@/components/Shell";
import { Heart, Search, ShoppingCart, Trash2 } from "lucide-react";

type WishlistItem = {
  id: string;
  title: string;
  platform?: string | null;
  category: "GAME" | "SYSTEM" | "PERIPHERAL" | "TOYS_TO_LIFE";
  priority: "LOW" | "MEDIUM" | "HIGH";
  targetPrice?: string | null;
  notes?: string | null;
  imageUrl?: string | null;
  barcode?: string | null;
  createdAt: string;
};

const sortOptions = [
  ["newest", "Date added: newest"],
  ["oldest", "Date added: oldest"],
  ["name", "Name A-Z"],
  ["name-desc", "Name Z-A"],
  ["priority", "Priority"],
  ["target-price", "Target price: low to high"],
  ["target-price-desc", "Target price: high to low"]
];

function money(value: string | number | null | undefined) {
  if (value === null || typeof value === "undefined" || value === "") return "—";

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(Number(value));
}

export default function WishlistPage() {
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [sort, setSort] = useState("newest");
  const [message, setMessage] = useState("");

  const [metadataQuery, setMetadataQuery] = useState("");
  const [metadataProvider, setMetadataProvider] = useState("all");
  const [metadataResults, setMetadataResults] = useState<MetadataResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const [title, setTitle] = useState("");
  const [platform, setPlatform] = useState("");
  const [category, setCategory] = useState<WishlistItem["category"]>("GAME");
  const [priority, setPriority] = useState<WishlistItem["priority"]>("MEDIUM");
  const [targetPrice, setTargetPrice] = useState("");
  const [barcode, setBarcode] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [notes, setNotes] = useState("");

  const [purchaseCollectionId, setPurchaseCollectionId] = useState<Record<string, string>>({});
  const [purchasePrice, setPurchasePrice] = useState<Record<string, string>>({});

  async function load(nextSort = sort) {
    setMessage("");

    try {
      const [listData, collectionData] = await Promise.all([
        api<{ items: WishlistItem[] }>(`/lists/wishlist?sort=${nextSort}`),
        api<{ collections: Collection[] }>("/collections")
      ]);

      setItems(listData.items);
      setCollections(collectionData.collections);
    } catch (err: any) {
      setMessage(err.message || "Failed to load wishlist.");
    }
  }

  async function searchMetadata(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");

    if (metadataQuery.trim().length < 2) {
      setMessage("Enter at least 2 characters to search.");
      return;
    }

    setIsSearching(true);

    try {
      const data = await api<{
        results: MetadataResult[];
        errors: Array<{ provider: string; error: string }>;
      }>(`/metadata/search?q=${encodeURIComponent(metadataQuery)}&provider=${encodeURIComponent(metadataProvider)}`);

      setMetadataResults(data.results);

      if (data.results.length === 0) {
        setMessage("No metadata results found. You can still add it manually.");
      }
    } catch (err: any) {
      setMessage(err.message || "Metadata search failed.");
    } finally {
      setIsSearching(false);
    }
  }

  function useMetadata(result: MetadataResult) {
    setTitle(result.title || "");
    setPlatform(result.platformName || "");
    setCategory("GAME");
    setBarcode(result.barcode || "");
    setImageUrl(result.coverUrl || "");
    setNotes(result.description || "");
    setMessage(`Loaded metadata from ${result.provider}. Review before adding to wishlist.`);
  }

  async function addItem(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");

    try {
      await api("/lists/wishlist", {
        method: "POST",
        body: JSON.stringify({
          title,
          platform: platform || null,
          category,
          priority,
          targetPrice: targetPrice || null,
          barcode: barcode || null,
          imageUrl: imageUrl || null,
          notes: notes || null
        })
      });

      setTitle("");
      setPlatform("");
      setCategory("GAME");
      setPriority("MEDIUM");
      setTargetPrice("");
      setBarcode("");
      setImageUrl("");
      setNotes("");
      setMetadataResults([]);
      await load();
      setMessage("Wishlist item added.");
    } catch (err: any) {
      setMessage(err.message || "Failed to add wishlist item.");
    }
  }

  async function removeItem(id: string) {
    setMessage("");

    try {
      await api(`/lists/wishlist/${id}`, {
        method: "DELETE"
      });

      await load();
      setMessage("Wishlist item removed.");
    } catch (err: any) {
      setMessage(err.message || "Failed to remove wishlist item.");
    }
  }

  async function markPurchased(item: WishlistItem) {
    setMessage("");

    const collectionId = purchaseCollectionId[item.id];

    if (!collectionId) {
      setMessage("Choose a collection first.");
      return;
    }

    try {
      await api(`/lists/wishlist/${item.id}/purchase`, {
        method: "POST",
        body: JSON.stringify({
          collectionId,
          purchasePrice: purchasePrice[item.id] || item.targetPrice || null,
          currentValue: purchasePrice[item.id] || item.targetPrice || null
        })
      });

      await load();
      setMessage("Wishlist item added to collection.");
    } catch (err: any) {
      setMessage(err.message || "Failed to add item to collection.");
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
      <div className="grid gap-6 lg:grid-cols-[430px_1fr]">
        <section className="space-y-6">
          <Card>
            <div className="mb-5 flex items-center gap-3">
              <Search className="h-6 w-6 vgc-accent-text" />

              <div>
                <h2 className="text-xl font-bold">Search Wishlist Metadata</h2>
                <p className="vgc-muted text-sm text-zinc-400">
                  Search configured metadata providers, then load the result into your wishlist form.
                </p>
              </div>
            </div>

            <form onSubmit={searchMetadata} className="space-y-3">
              <Input
                placeholder="Search game metadata"
                value={metadataQuery}
                onChange={(e) => setMetadataQuery(e.target.value)}
              />

              <select
                className="vgc-select"
                style={{ colorScheme: "light" }}
                value={metadataProvider}
                onChange={(e) => setMetadataProvider(e.target.value)}
              >
                <option value="all">All configured providers</option>
                <option value="rawg">RAWG</option>
                <option value="igdb">IGDB</option>
                <option value="giantbomb">GiantBomb</option>
                <option value="mobygames">MobyGames</option>
                <option value="steam">Steam</option>
                <option value="custom">Custom</option>
              </select>

              <Button type="submit" className="w-full" disabled={isSearching}>
                {isSearching ? "Searching..." : "Search metadata"}
              </Button>
            </form>

            <div className="mt-4 space-y-3">
              {metadataResults.map((result) => (
                <button
                  key={`${result.provider}-${result.externalId}`}
                  type="button"
                  onClick={() => useMetadata(result)}
                  className="vgc-surface w-full rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-left hover:vgc-accent-border"
                >
                  <div className="flex gap-3">
                    {result.coverUrl && <img src={result.coverUrl} alt="" className="h-16 w-12 rounded object-cover" />}

                    <div>
                      <div className="font-semibold">{result.title}</div>

                      <div className="vgc-muted text-xs text-zinc-400">
                        {result.provider}
                        {result.releaseYear ? ` · ${result.releaseYear}` : ""}
                        {result.platformName ? ` · ${result.platformName}` : ""}
                      </div>

                      {result.description && (
                        <p className="vgc-muted mt-1 line-clamp-2 text-xs text-zinc-400">
                          {result.description}
                        </p>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </Card>

          <Card>
            <div className="mb-5 flex items-center gap-3">
              <Heart className="h-6 w-6 vgc-accent-text" />

              <div>
                <h2 className="text-xl font-bold">Add to Wishlist</h2>
                <p className="vgc-muted text-sm text-zinc-400">
                  Use metadata search above or enter details manually.
                </p>
              </div>
            </div>

            <form onSubmit={addItem} className="space-y-3">
              <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} required />
              <Input placeholder="Platform" value={platform} onChange={(e) => setPlatform(e.target.value)} />

              <select
                className="vgc-select"
                style={{ colorScheme: "light" }}
                value={category}
                onChange={(e) => setCategory(e.target.value as WishlistItem["category"])}
              >
                <option value="GAME">Game</option>
                <option value="SYSTEM">System</option>
                <option value="PERIPHERAL">Peripheral</option>
                <option value="TOYS_TO_LIFE">Toys-to-life</option>
              </select>

              <select
                className="vgc-select"
                style={{ colorScheme: "light" }}
                value={priority}
                onChange={(e) => setPriority(e.target.value as WishlistItem["priority"])}
              >
                <option value="LOW">Low priority</option>
                <option value="MEDIUM">Medium priority</option>
                <option value="HIGH">High priority</option>
              </select>

              <Input placeholder="Target price" value={targetPrice} onChange={(e) => setTargetPrice(e.target.value)} />
              <Input placeholder="Barcode" value={barcode} onChange={(e) => setBarcode(e.target.value)} />
              <Input placeholder="Image URL" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} />

              <label className="block">
                <span className="mb-2 block text-sm font-medium">Notes</span>
                <textarea
                  className="min-h-[120px] w-full resize-y rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm leading-6 text-zinc-950 outline-none placeholder:text-zinc-500 focus:ring-2 focus:vgc-accent-ring"
                  placeholder="Add notes, preferred edition, target condition, pricing details, or anything else you want to remember."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </label>

              <Button type="submit" className="mt-3 w-full justify-center">
                Add to Wishlist
              </Button>
            </form>
          </Card>
        </section>

        <section>
          <Card>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-xl font-bold">Wishlist Items</h2>
                <p className="vgc-muted text-sm text-zinc-400">{items.length} items</p>
              </div>

              <label className="block md:w-64">
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
                        {item.platform || "Unknown platform"} · {item.priority} priority
                      </p>

                      <p className="mt-1 text-sm">Target: {money(item.targetPrice)}</p>

                      {item.barcode && <p className="vgc-muted mt-1 text-xs text-zinc-400">Barcode: {item.barcode}</p>}

                      {item.notes && <p className="mt-2 line-clamp-3 text-sm text-zinc-300">{item.notes}</p>}
                    </div>

                    {item.imageUrl && <img src={item.imageUrl} alt="" className="h-24 w-24 rounded-lg object-cover" />}
                  </div>

                  <div className="mt-4 grid gap-2 md:grid-cols-[1fr_140px_auto_auto]">
                    <select
                      className="vgc-select"
                      style={{ colorScheme: "light" }}
                      value={purchaseCollectionId[item.id] || ""}
                      onChange={(e) => setPurchaseCollectionId((prev) => ({ ...prev, [item.id]: e.target.value }))}
                    >
                      <option value="">Choose collection</option>

                      {collections.map((collection) => (
                        <option key={collection.id} value={collection.id}>
                          {collection.name}
                        </option>
                      ))}
                    </select>

                    <Input
                      placeholder="Paid"
                      value={purchasePrice[item.id] || ""}
                      onChange={(e) => setPurchasePrice((prev) => ({ ...prev, [item.id]: e.target.value }))}
                    />

                    <Button type="button" onClick={() => markPurchased(item)}>
                      <ShoppingCart className="mr-2 h-4 w-4" />
                      Purchased
                    </Button>

                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="rounded-xl border border-red-800 px-4 py-2 text-sm font-semibold text-red-300 hover:bg-red-950"
                      aria-label="Remove from wishlist"
                      title="Remove from wishlist"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}

              {items.length === 0 && (
                <p className="rounded-xl border border-dashed border-zinc-700 p-8 text-center text-zinc-400">
                  No wishlist items yet.
                </p>
              )}
            </div>
          </Card>
        </section>
      </div>
    </Shell>
  );
}
