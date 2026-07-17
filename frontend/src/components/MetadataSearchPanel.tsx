"use client";

import { FormEvent, useMemo, useState } from "react";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { MetadataResult } from "@/lib/api";

type MetadataSearchPanelProps = {
  query: string;
  provider: string;
  results: MetadataResult[];
  isSearching: boolean;
  placeholder: string;
  canEdit: boolean;
  onQueryChange: (value: string) => void;
  onProviderChange: (value: string) => void;
  onSearch: (event: FormEvent) => void;
  onSearchMore: (query: string, provider: string) => Promise<MetadataResult[]>;
  onSelect: (result: MetadataResult) => void;
  onCreateCustom: () => void;
};

const providerOptions = [
  { value: "all", label: "All configured providers" },
  { value: "pricecharting", label: "PriceCharting" },
  { value: "rawg", label: "RAWG" },
  { value: "igdb", label: "IGDB" },
  { value: "giantbomb", label: "GiantBomb" },
  { value: "mobygames", label: "MobyGames" },
  { value: "steam", label: "Steam" },
  { value: "custom", label: "Custom" }
];

function normalized(value?: string | null) {
  return (value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function rankResult(result: MetadataResult, query: string) {
  const title = normalized(result.title);
  const platform = normalized(result.platformName);
  const search = normalized(query);
  if (!search) return 0;
  if (`${title} ${platform}`.trim() === search) return 500;
  if (title === search) return 450;
  if (title.startsWith(search)) return 350;
  if (title.includes(search)) return 250;
  const terms = search.split(" ").filter(Boolean);
  return terms.reduce((score, term) => score + (title.includes(term) ? 25 : 0) + (platform.includes(term) ? 10 : 0), 0);
}

function sortResults(results: MetadataResult[], query: string) {
  return [...results].sort((a, b) => {
    const rank = rankResult(b, query) - rankResult(a, query);
    if (rank) return rank;
    return a.title.localeCompare(b.title);
  });
}

function ResultCard({ result, onSelect }: { result: MetadataResult; onSelect: (result: MetadataResult) => void }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(result)}
      onDoubleClick={() => onSelect(result)}
      className="vgc-surface w-full rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-left transition hover:vgc-accent-border focus:outline-none focus:ring-2 focus:ring-[rgb(var(--vgc-accent-rgb,59_130_246))]"
    >
      <div className="flex gap-3">
        {result.coverUrl && <img src={result.coverUrl} alt="" className="h-20 w-14 shrink-0 rounded object-cover" />}
        <div className="min-w-0 flex-1">
          <div className="font-semibold">{result.title}</div>
          <div className="vgc-muted text-xs text-zinc-400">
            {result.provider}{result.releaseYear ? ` · ${result.releaseYear}` : ""}{result.platformName ? ` · ${result.platformName}` : ""}
          </div>
          {result.description && <p className="vgc-muted mt-1 line-clamp-3 text-xs text-zinc-400">{result.description}</p>}
          {result.priceChartingProductId && <p className="mt-1 text-xs vgc-accent-text">Select to use this PriceCharting product match.</p>}
        </div>
        <span className="self-center rounded-lg border border-zinc-700 px-3 py-1 text-xs">Select</span>
      </div>
    </button>
  );
}

export function MetadataSearchPanel(props: MetadataSearchPanelProps) {
  const {
    query, provider, results, isSearching, placeholder, canEdit,
    onQueryChange, onProviderChange, onSearch, onSearchMore, onSelect, onCreateCustom
  } = props;
  const [showMore, setShowMore] = useState(false);
  const [moreResults, setMoreResults] = useState<MetadataResult[]>([]);
  const [moreQuery, setMoreQuery] = useState(query);
  const [moreProvider, setMoreProvider] = useState(provider);
  const [platformFilter, setPlatformFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState("all");
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState("");

  const rankedInline = useMemo(() => sortResults(results, query), [results, query]);
  const visibleInline = rankedInline.slice(0, 10);

  const platforms = useMemo(() => Array.from(new Set(moreResults.map((r) => r.platformName).filter(Boolean) as string[])).sort(), [moreResults]);
  const years = useMemo(() => Array.from(new Set(moreResults.map((r) => r.releaseYear).filter(Boolean) as number[])).sort((a, b) => b - a), [moreResults]);
  const filteredMore = useMemo(() => sortResults(moreResults, moreQuery).filter((result) => {
    if (platformFilter !== "all" && result.platformName !== platformFilter) return false;
    if (yearFilter !== "all" && String(result.releaseYear || "") !== yearFilter) return false;
    return true;
  }), [moreResults, moreQuery, platformFilter, yearFilter]);

  if (!canEdit) return <p className="rounded-lg bg-zinc-800 p-3 text-sm text-zinc-300">You have viewer access.</p>;

  async function loadMore(nextQuery = moreQuery, nextProvider = moreProvider) {
    if (nextQuery.trim().length < 2) {
      setMoreError("Enter at least 2 characters to search.");
      return;
    }
    setLoadingMore(true);
    setMoreError("");
    try {
      const expanded = await onSearchMore(nextQuery.trim(), nextProvider);
      setMoreResults(expanded);
      if (!expanded.length) setMoreError("No additional metadata results were found.");
    } catch (error: any) {
      setMoreError(error?.message || "Expanded metadata search failed.");
    } finally {
      setLoadingMore(false);
    }
  }

  async function openMore() {
    setMoreQuery(query);
    setMoreProvider(provider);
    setPlatformFilter("all");
    setYearFilter("all");
    setShowMore(true);
    await loadMore(query, provider);
  }

  return (
    <>
      <form onSubmit={onSearch} className="space-y-3">
        <Input placeholder={placeholder} value={query} onChange={(event) => onQueryChange(event.target.value)} />
        <select className="vgc-select" style={{ colorScheme: "light" }} value={provider} onChange={(event) => onProviderChange(event.target.value)}>
          {providerOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <Button type="submit" className="w-full" disabled={isSearching}>{isSearching ? "Searching..." : "Search metadata"}</Button>
      </form>

      <div className="mt-4 space-y-3">
        {visibleInline.map((result) => <ResultCard key={`${result.provider}-${result.externalId}`} result={result} onSelect={onSelect} />)}
      </div>

      {(results.length > 0 || query.trim().length >= 2) && (
        <div className="mt-4 rounded-xl border border-dashed border-zinc-700 p-3 text-center">
          <p className="mb-3 text-sm text-zinc-400">Can&apos;t find the item you need?</p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button type="button" onClick={openMore}>Search more results...</Button>
            <button type="button" onClick={onCreateCustom} className="rounded-xl border border-zinc-700 px-4 py-2 text-sm font-semibold hover:bg-zinc-800">Create custom item</button>
          </div>
        </div>
      )}

      {showMore && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 p-3" role="dialog" aria-modal="true" aria-label="More metadata results">
          <div className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-900 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 p-4">
              <div><h3 className="text-xl font-bold">Search More Metadata Results</h3><p className="text-xs text-zinc-400">Exact title and platform matches are ranked first.</p></div>
              <button type="button" onClick={() => setShowMore(false)} className="rounded-lg border border-zinc-700 px-3 py-2 text-sm hover:bg-zinc-800">Close</button>
            </div>
            <form onSubmit={(event) => { event.preventDefault(); void loadMore(); }} className="grid gap-3 border-b border-zinc-800 p-4 md:grid-cols-[1fr_220px_auto]">
              <Input value={moreQuery} onChange={(e) => setMoreQuery(e.target.value)} placeholder={placeholder} />
              <select className="vgc-select" style={{ colorScheme: "light" }} value={moreProvider} onChange={(e) => setMoreProvider(e.target.value)}>
                {providerOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
              <Button type="submit" disabled={loadingMore}>{loadingMore ? "Searching..." : "Search"}</Button>
            </form>
            <div className="grid gap-3 border-b border-zinc-800 p-4 md:grid-cols-2">
              <select className="vgc-select" style={{ colorScheme: "light" }} value={platformFilter} onChange={(e) => setPlatformFilter(e.target.value)}>
                <option value="all">All platforms</option>{platforms.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
              <select className="vgc-select" style={{ colorScheme: "light" }} value={yearFilter} onChange={(e) => setYearFilter(e.target.value)}>
                <option value="all">All release years</option>{years.map((item) => <option key={item} value={String(item)}>{item}</option>)}
              </select>
            </div>
            <div className="overflow-y-auto p-4">
              {moreError && <p className="mb-3 rounded-lg bg-zinc-800 p-3 text-sm">{moreError}</p>}
              {!loadingMore && <p className="mb-3 text-sm text-zinc-400">Showing {filteredMore.length} result{filteredMore.length === 1 ? "" : "s"}.</p>}
              <div className="grid gap-3 md:grid-cols-2">
                {filteredMore.map((result) => <ResultCard key={`${result.provider}-${result.externalId}`} result={result} onSelect={(selected) => { onSelect(selected); setShowMore(false); }} />)}
              </div>
            </div>
            <div className="flex flex-wrap justify-between gap-2 border-t border-zinc-800 p-4">
              <button type="button" onClick={() => { onCreateCustom(); setShowMore(false); }} className="rounded-xl border border-zinc-700 px-4 py-2 text-sm font-semibold hover:bg-zinc-800">Create Custom Item</button>
              <Button type="button" onClick={() => setShowMore(false)}>Done</Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
