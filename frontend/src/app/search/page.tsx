"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { Shell } from "@/components/Shell";
import { Search } from "lucide-react";

type SearchResult = {
  type: string;
  id: string;
  title: string;
  subtitle: string;
  url: string;
  assetTag?: string | null;
  status: string;
};

function getInitialQuery() {
  if (typeof window === "undefined") return "";

  return new URLSearchParams(window.location.search).get("q") || "";
}

function typeLabel(type: string) {
  return type.replaceAll("_", " ").replaceAll("-", " ");
}

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const filteredResults = useMemo(() => {
    if (typeFilter === "all") return results;

    return results.filter((result) => result.type === typeFilter);
  }, [results, typeFilter]);

  const resultTypes = useMemo(() => {
    return Array.from(new Set(results.map((result) => result.type))).sort();
  }, [results]);

  async function runSearch(value: string) {
    setMessage("");

    const trimmed = value.trim();

    if (trimmed.length < 2) {
      setResults([]);
      return;
    }

    setLoading(true);

    try {
      const data = await api<{ results: SearchResult[] }>(`/search?q=${encodeURIComponent(trimmed)}`);
      setResults(data.results);
    } catch (err: any) {
      setMessage(err.message || "Search failed.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const initial = getInitialQuery();
    setQuery(initial);

    if (initial.trim().length >= 2) {
      runSearch(initial);
    }
  }, []);

  useEffect(() => {
    const handle = setTimeout(() => {
      runSearch(query);
    }, 250);

    return () => clearTimeout(handle);
  }, [query]);

  return (
    <Shell>
      <Card>
        <div className="mb-5 flex items-center gap-3">
          <Search className="h-6 w-6 vgc-accent-text" />
          <div>
            <h2 className="text-xl font-bold">Search</h2>
            <p className="vgc-muted text-sm text-zinc-400">
              Search games, platforms, asset tags, barcodes, serial numbers, systems, peripherals, toys-to-life, and collections.
            </p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-[1fr_220px]">
          <Input
            placeholder="Search your collection..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />

          <select
            className="vgc-select"
            style={{ colorScheme: "light" }}
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="all">All result types</option>
            {resultTypes.map((type) => (
              <option key={type} value={type}>
                {typeLabel(type)}
              </option>
            ))}
          </select>
        </div>

        {loading && <p className="mt-4 rounded-lg bg-zinc-800 p-3 text-sm">Searching...</p>}
        {message && <p className="mt-4 rounded-lg bg-zinc-800 p-3 text-sm">{message}</p>}

        <div className="mt-6 grid gap-3">
          {filteredResults.map((result) => (
            <a
              key={`${result.type}-${result.id}-${result.assetTag || ""}`}
              href={result.url}
              className="vgc-surface rounded-xl border border-zinc-800 bg-zinc-950 p-4 hover:vgc-accent-border"
            >
              <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="text-xs uppercase tracking-wide text-zinc-500">{typeLabel(result.type)}</div>
                  <h3 className="font-semibold">{result.title}</h3>
                  <p className="vgc-muted text-sm text-zinc-400">{result.subtitle}</p>
                </div>

                <div className="text-left md:text-right">
                  {result.assetTag && <div className="font-mono text-sm vgc-accent-text">{result.assetTag}</div>}
                  <div className={result.status.startsWith("Checked out") ? "text-sm text-red-300" : "text-sm text-green-300"}>
                    {result.status}
                  </div>
                </div>
              </div>
            </a>
          ))}
        </div>

        {query.trim().length >= 2 && filteredResults.length === 0 && !message && !loading && (
          <p className="mt-6 rounded-xl border border-dashed border-zinc-700 p-8 text-center text-zinc-400">
            No results found.
          </p>
        )}

        {query.trim().length < 2 && (
          <p className="mt-6 rounded-xl border border-dashed border-zinc-700 p-8 text-center text-zinc-400">
            Enter at least 2 characters to search.
          </p>
        )}
      </Card>
    </Shell>
  );
}
