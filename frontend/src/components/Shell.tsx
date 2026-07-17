"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  api,
  clearToken,
  getToken,
  redirectToLogin,
  User
} from "@/lib/api";
import {
  applyBranding,
  Branding,
  loadBranding,
  resolvedAppIconUrl
} from "@/lib/branding";
import { applyTheme } from "@/lib/theme";
import {
  BarChart3,
  Gamepad2,
  Heart,
  LogOut,
  Search,
  Settings,
  ShieldCheck,
  Tag,
  Clock3
} from "lucide-react";

type SearchResult = {
  type: string;
  id: string;
  title: string;
  subtitle: string;
  url: string;
  assetTag?: string | null;
  status: string;
  matchedBy?: string[];
};

function typeLabel(type: string) {
  return type.replaceAll("_", " ").replaceAll("-", " ");
}

export function Shell({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchMessage, setSearchMessage] = useState("");
  const searchBoxRef = useRef<HTMLFormElement | null>(null);

  const [branding, setBranding] = useState<Branding>({
    appName: "VGC Shelf",
    pageTitle: "VGC Shelf",
    appIconUrl: "/vgcs-icon.png",
    assetTagPrefix: "VGC",
    labelText: ""
  });

  const previewResults = useMemo(() => searchResults.slice(0, 8), [searchResults]);

  useEffect(() => {
    applyTheme();

    const token = getToken();

    if (!token) {
      clearToken();
      redirectToLogin();
      return;
    }

    api<{ user: User }>("/auth/me")
      .then((data) => {
        setUser(data.user);
        setAuthChecked(true);
      })
      .catch(() => {
        clearToken();
        redirectToLogin();
      });

    loadBranding().then((nextBranding) => {
      setBranding(nextBranding);
      applyBranding(nextBranding);
    });
  }, []);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!searchBoxRef.current) return;
      if (!searchBoxRef.current.contains(event.target as Node)) {
        setSearchOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  useEffect(() => {
    const trimmed = searchQuery.trim();

    if (trimmed.length < 2) {
      setSearchResults([]);
      setSearchMessage("");
      setSearchLoading(false);
      return;
    }

    let cancelled = false;
    const handle = setTimeout(async () => {
      setSearchLoading(true);
      setSearchMessage("");

      try {
        const data = await api<{ results: SearchResult[] }>(
          `/search?q=${encodeURIComponent(trimmed)}`
        );

        if (!cancelled) {
          setSearchResults(data.results || []);
          setSearchOpen(true);
        }
      } catch (err: any) {
        if (!cancelled) {
          setSearchResults([]);
          setSearchMessage(err.message || "Search failed.");
          setSearchOpen(true);
        }
      } finally {
        if (!cancelled) {
          setSearchLoading(false);
        }
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [searchQuery]);

  const appIconUrl = resolvedAppIconUrl(branding);

  function logout() {
    clearToken();
    window.location.href = "/";
  }

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();

    const trimmed = searchQuery.trim();

    window.location.href = trimmed
      ? `/search?q=${encodeURIComponent(trimmed)}`
      : "/search";
  }

  function openResult(url: string) {
    setSearchOpen(false);
    window.location.href = url;
  }

  if (!authChecked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-100">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 text-sm text-zinc-300">
          Checking session...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-3 py-3 sm:px-4 lg:px-6 lg:py-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              {appIconUrl ? (
                <img
                  src={appIconUrl}
                  alt=""
                  className="h-9 w-9 shrink-0 rounded-md object-contain sm:h-8 sm:w-8"
                />
              ) : (
                <Gamepad2 className="h-8 w-8 shrink-0 vgc-accent-text sm:h-7 sm:w-7" />
              )}

              <div className="min-w-0">
                <h1 className="truncate text-lg font-bold sm:text-xl">{branding.appName}</h1>

                <p className="truncate text-xs text-zinc-400">
                  {user
                    ? `${user.email} · ${user.role}`
                    : "Video game collection tracker"}
                </p>
              </div>
            </div>

            <form
              ref={searchBoxRef}
              onSubmit={submitSearch}
              className="relative flex w-full flex-col gap-2 sm:flex-row lg:max-w-md"
            >
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />

                <input
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    if (e.target.value.trim().length >= 2) {
                      setSearchOpen(true);
                    }
                  }}
                  onFocus={() => {
                    if (searchQuery.trim().length >= 2) {
                      setSearchOpen(true);
                    }
                  }}
                  placeholder="Search tags, barcodes, borrowers..."
                  className="w-full min-h-11 rounded-xl border border-zinc-700 bg-zinc-950 px-10 py-3 text-base outline-none placeholder:text-zinc-500 focus:ring-2 focus:ring-indigo-500 sm:text-sm"
                />

                {searchOpen && searchQuery.trim().length >= 2 && (
                  <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-50 max-h-[65dvh] overflow-hidden rounded-xl border border-zinc-700 bg-zinc-950 shadow-2xl shadow-black/40">
                    {searchLoading && (
                      <div className="px-4 py-3 text-sm text-zinc-400">Searching...</div>
                    )}

                    {!searchLoading && searchMessage && (
                      <div className="px-4 py-3 text-sm text-red-300">{searchMessage}</div>
                    )}

                    {!searchLoading && !searchMessage && previewResults.length === 0 && (
                      <div className="px-4 py-3 text-sm text-zinc-400">No results found.</div>
                    )}

                    {!searchLoading && !searchMessage && previewResults.length > 0 && (
                      <div className="max-h-[48dvh] overflow-y-auto py-2">
                        {previewResults.map((result) => (
                          <button
                            key={`${result.type}-${result.id}-${result.assetTag || ""}`}
                            type="button"
                            onClick={() => openResult(result.url)}
                            className="block w-full px-4 py-3 text-left hover:bg-zinc-900"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="text-[11px] uppercase tracking-wide text-zinc-500">
                                  {typeLabel(result.type)}
                                </div>
                                <div className="truncate text-sm font-semibold text-zinc-100">
                                  {result.title}
                                </div>
                                <div className="truncate text-xs text-zinc-400">
                                  {result.subtitle}
                                </div>
                                {result.matchedBy && result.matchedBy.length > 0 && (
                                  <div className="mt-1 truncate text-[10px] uppercase tracking-wide text-zinc-600">
                                    Matched {result.matchedBy.join(", ")}
                                  </div>
                                )}
                              </div>

                              <div className="shrink-0 text-right">
                                {result.assetTag && (
                                  <div className="font-mono text-xs vgc-accent-text">
                                    {result.assetTag}
                                  </div>
                                )}
                                <div
                                  className={
                                    result.status.startsWith("Checked out")
                                      ? "text-xs text-red-300"
                                      : "text-xs text-green-300"
                                  }
                                >
                                  {result.status}
                                </div>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}

                    <button
                      type="submit"
                      className="block w-full border-t border-zinc-800 !bg-zinc-900 px-4 py-3 text-left text-sm font-semibold !text-zinc-100 hover:!bg-zinc-800"
                    >
                      View full search results
                    </button>
                  </div>
                )}
              </div>

              <button
                type="submit"
                className="vgc-accent-bg min-h-11 rounded-xl px-5 py-3 text-sm font-semibold text-white sm:w-auto"
              >
                Search
              </button>
            </form>
          </div>

          <nav className="-mx-3 flex items-center gap-2 overflow-x-auto px-3 pb-1 sm:mx-0 sm:flex-wrap sm:px-0 sm:pb-0">
            <a
              href="/collections"
              className="inline-flex min-h-10 shrink-0 items-center rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
            >
              Collections
            </a>

            <a
              href="/wishlist"
              className="inline-flex min-h-10 shrink-0 items-center rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
            >
              <span className="flex items-center gap-2">
                <Heart className="h-4 w-4" />
                Wishlist
              </span>
            </a>

            <a
              href="/sell-list"
              className="inline-flex min-h-10 shrink-0 items-center rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
            >
              <span className="flex items-center gap-2">
                <Tag className="h-4 w-4" />
                Sell List
              </span>
            </a>

            <a
              href="/reports"
              className="inline-flex min-h-10 shrink-0 items-center rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
            >
              <span className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Reports
              </span>
            </a>

            <a
              href="/lending"
              className="inline-flex min-h-10 shrink-0 items-center rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
            >
              <span className="flex items-center gap-2">
                <Clock3 className="h-4 w-4" />
                Lending
              </span>
            </a>

            <a
              href="/search"
              className="inline-flex min-h-10 shrink-0 items-center rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
            >
              <span className="flex items-center gap-2">
                <Search className="h-4 w-4" />
                Search
              </span>
            </a>

            <a
              href="/settings"
              className="inline-flex min-h-10 shrink-0 items-center rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
            >
              <span className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Settings
              </span>
            </a>

            {user?.role === "ADMIN" && (
              <a
                href="/admin/settings"
                className="inline-flex min-h-10 shrink-0 items-center rounded-lg border border-red-600 px-3 py-2 text-sm text-red-400 hover:bg-zinc-800"
              >
                <span className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4" />
                  Admin
                </span>
              </a>
            )}

            <button
              type="button"
              onClick={logout}
              className="inline-flex min-h-10 shrink-0 items-center rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-3 py-4 sm:px-4 sm:py-5 lg:px-6 lg:py-6">
        {children}
      </main>
    </div>
  );
}
