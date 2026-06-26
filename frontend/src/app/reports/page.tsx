"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { Card } from "@/components/Card";
import { Shell } from "@/components/Shell";
import { AlertTriangle, BarChart3, Copy, DatabaseZap, PieChart, TrendingUp } from "lucide-react";

type ReportRow = { label: string; value: number };

type DuplicateGroup = {
  type: string;
  key: string;
  count: number;
  items: Array<{
    id: string;
    kind: string;
    title: string;
    platform?: string;
    collectionName: string;
    collectionId: string;
    barcode?: string;
    serialNumber?: string;
    assetTag?: string | null;
    status: string;
  }>;
};

type MetadataReport = {
  summary: {
    missingBarcodes: number;
    missingImages: number;
    missingPlatforms: number;
    missingRegions: number;
    missingValues: number;
    suggestions: number;
    platformAliasGroups: number;
  };
  platformAliasGroups: Array<{ normalized: string; variants: string[] }>;
  suggestions: Array<{
    kind: string;
    id: string;
    title: string;
    collectionName: string;
    rawPlatform?: string;
    normalizedPlatform?: string;
    rawRegion?: string;
    normalizedRegion?: string;
    normalizedTitle?: string;
    warnings: string[];
  }>;
};

type Analytics = {
  summary: {
    collections: number;
    games: number;
    systems: number;
    peripherals: number;
    toysToLife: number;
    physicalGames: number;
    digitalGames: number;
    trackedParts: number;
    assetTags: number;
    loanedItems: number;
    totalPricePaid: number;
    totalCurrentValue: number;
    gainLoss: number;
    duplicateGroups: number;
    metadataWarnings: number;
  };
  valueByPlatform: ReportRow[];
  spendByPlatform: ReportRow[];
  countByPlatform: ReportRow[];
  valueByCollection: ReportRow[];
  spendByCollection: ReportRow[];
  countByCollection: ReportRow[];
  conditionBreakdown: ReportRow[];
  topValueItems: Array<{
    kind: string;
    title: string;
    platform: string;
    collectionName: string;
    pricePaid: number;
    currentValue: number;
    gainLoss: number;
    url: string;
  }>;
  loanedItems: Array<{
    kind: string;
    title: string;
    assetTag?: string | null;
    borrowerName: string;
    dueAt?: string | null;
    collectionName: string;
    url: string;
  }>;
  duplicateGroups: DuplicateGroup[];
  metadata: MetadataReport;
};

type Timeframe = "day" | "week" | "month" | "year" | "all";

type DashboardData = {
  timeframe: Timeframe;
  summary: {
    collections: number;
    games: number;
    platforms: number;
    systems: number;
    peripherals: number;
    toysToLife: number;
    physicalGames: number;
    digitalGames: number;
    trackedParts: number;
    checkedOut: number;
    totalPricePaid: number;
    totalCurrentValue: number;
    gainLoss: number;
  };
  collectionBreakdown?: Array<{
    label: string;
    value: number;
  }>;
  valueByCollection?: Array<{
    label: string;
    value: number;
  }>;
  timeline: Array<{
    label: string;
    startAt: string;
    endAt: string;
    totalCurrentValue: number;
    gainLoss: number;
  }>;
};

type DonutItem = {
  label: string;
  value: number;
};

const timeframeOptions: Array<{ value: Timeframe; label: string }> = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "year", label: "Year" },
  { value: "all", label: "All time" }
];

function money(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value || 0);
}

function percent(value: number, total: number) {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

function StatCard({ label, value, tone = "default" }: { label: string; value: string | number; tone?: "default" | "good" | "bad" | "warn" }) {
  const toneClass = tone === "good" ? "text-green-300" : tone === "bad" ? "text-red-300" : tone === "warn" ? "text-amber-300" : "";

  return (
    <div className="vgc-surface rounded-xl border border-zinc-800 bg-zinc-950 p-4">
      <div className="vgc-muted text-sm text-zinc-400">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${toneClass}`}>{value}</div>
    </div>
  );
}

function BarList({ rows, moneyValues = false }: { rows: ReportRow[]; moneyValues?: boolean }) {
  const max = Math.max(...rows.map((row) => row.value), 0);

  if (rows.length === 0 || max <= 0) {
    return <p className="text-sm text-zinc-400">No data yet.</p>;
  }

  return (
    <div className="space-y-3">
      {rows.slice(0, 12).map((row) => (
        <div key={row.label}>
          <div className="mb-1 flex items-center justify-between gap-3 text-sm">
            <span className="truncate">{row.label}</span>
            <span className="font-semibold">{moneyValues ? money(row.value) : row.value}</span>
          </div>
          <div className="h-2 rounded-full bg-zinc-800">
            <div className="h-2 rounded-full vgc-accent-bg" style={{ width: `${Math.max(4, percent(row.value, max))}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function SectionHeader({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="mb-5 flex items-start gap-3">
      <div className="mt-1 vgc-accent-text">{icon}</div>
      <div>
        <h2 className="text-xl font-bold">{title}</h2>
        <p className="vgc-muted text-sm text-zinc-400">{description}</p>
      </div>
    </div>
  );
}

function LineChart({
  data
}: {
  data: DashboardData["timeline"];
}) {
  const width = 900;
  const height = 320;
  const padding = {
    top: 24,
    right: 28,
    bottom: 54,
    left: 78
  };

  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const values = data.flatMap((row) => [row.totalCurrentValue, row.gainLoss]);
  const maxValue = Math.max(...values, 0);
  const minValue = Math.min(...values, 0);
  const range = maxValue - minValue || 1;

  function x(index: number) {
    if (data.length <= 1) return padding.left;
    return padding.left + (index / (data.length - 1)) * chartWidth;
  }

  function y(value: number) {
    return padding.top + ((maxValue - value) / range) * chartHeight;
  }

  function points(key: "totalCurrentValue" | "gainLoss") {
    return data.map((row, index) => `${x(index)},${y(row[key])}`).join(" ");
  }

  const yTicks = Array.from({ length: 5 }, (_, index) => {
    const value = minValue + (range / 4) * index;
    return Math.round(value);
  }).reverse();

  const visibleXLabels = data.filter((_, index) => {
    if (data.length <= 8) return true;
    const step = Math.ceil(data.length / 6);
    return index % step === 0 || index === data.length - 1;
  });

  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-700 p-8 text-center text-zinc-400">
        No timeline data yet.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="min-w-[760px]">
        <rect x="0" y="0" width={width} height={height} rx="18" className="fill-[rgb(var(--vgc-surface-rgb,9_9_11))]" />

        {yTicks.map((tick) => (
          <g key={tick}>
            <line
              x1={padding.left}
              x2={width - padding.right}
              y1={y(tick)}
              y2={y(tick)}
              className="stroke-[rgb(var(--vgc-border-rgb,39_39_42))]"
              strokeWidth="1"
            />
            <text
              x={padding.left - 12}
              y={y(tick) + 4}
              textAnchor="end"
              className="fill-[rgb(var(--vgc-muted-rgb,161_161_170))] text-[12px]"
            >
              {money(tick)}
            </text>
          </g>
        ))}

        <line
          x1={padding.left}
          x2={width - padding.right}
          y1={y(0)}
          y2={y(0)}
          className="stroke-[rgb(var(--vgc-muted-rgb,161_161_170))]"
          strokeWidth="1.5"
          strokeDasharray="4 4"
        />

        <polyline
          fill="none"
          stroke="rgb(var(--vgc-accent-rgb,59 130 246))"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points("totalCurrentValue")}
        />

        <polyline
          fill="none"
          stroke="rgb(var(--vgc-chart-secondary-rgb,34 197 94))"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points("gainLoss")}
        />

        {data.map((row, index) => (
          <g key={`${row.label}-${index}`}>
            <circle cx={x(index)} cy={y(row.totalCurrentValue)} r="4" fill="rgb(var(--vgc-accent-rgb,59 130 246))" />
            <circle cx={x(index)} cy={y(row.gainLoss)} r="4" fill="rgb(var(--vgc-chart-secondary-rgb,34 197 94))" />
          </g>
        ))}

        {visibleXLabels.map((row) => {
          const index = data.indexOf(row);

          return (
            <text
              key={`${row.label}-${index}`}
              x={x(index)}
              y={height - 22}
              textAnchor="middle"
              className="fill-[rgb(var(--vgc-muted-rgb,161_161_170))] text-[12px]"
            >
              {row.label}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

function polarToCartesian(centerX: number, centerY: number, radius: number, angleInDegrees: number) {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180;

  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians)
  };
}

function donutPath(cx: number, cy: number, outerRadius: number, innerRadius: number, startAngle: number, endAngle: number) {
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";

  const outerStart = polarToCartesian(cx, cy, outerRadius, endAngle);
  const outerEnd = polarToCartesian(cx, cy, outerRadius, startAngle);
  const innerStart = polarToCartesian(cx, cy, innerRadius, startAngle);
  const innerEnd = polarToCartesian(cx, cy, innerRadius, endAngle);

  return [
    "M", outerStart.x, outerStart.y,
    "A", outerRadius, outerRadius, 0, largeArcFlag, 0, outerEnd.x, outerEnd.y,
    "L", innerStart.x, innerStart.y,
    "A", innerRadius, innerRadius, 0, largeArcFlag, 1, innerEnd.x, innerEnd.y,
    "Z"
  ].join(" ");
}

function DonutChart({
  title,
  items,
  valueFormatter = (value) => String(value)
}: {
  title: string;
  items: DonutItem[];
  valueFormatter?: (value: number) => string;
}) {
  const filtered = items.filter((item) => item.value > 0);
  const total = filtered.reduce((sum, item) => sum + item.value, 0);

  const colors = [
    "rgb(var(--vgc-accent-rgb,59 130 246))",
    "rgb(var(--vgc-chart-secondary-rgb,34 197 94))",
    "rgb(var(--vgc-chart-tertiary-rgb,245 158 11))",
    "rgb(var(--vgc-chart-quaternary-rgb,168 85 247))",
    "rgb(var(--vgc-chart-danger-rgb,244 63 94))"
  ];

  let cursor = 0;

  return (
    <Card>
      <div className="mb-4 flex items-center gap-2">
        <PieChart className="h-5 w-5 vgc-accent-text" />
        <h3 className="font-bold">{title}</h3>
      </div>

      {total <= 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-700 p-8 text-center text-zinc-400">No data yet.</p>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[170px_minmax(0,1fr)] xl:items-center">
          <div className="flex justify-center">
            <svg viewBox="0 0 160 160" className="h-40 w-40">
              <circle cx="80" cy="80" r="66" className="fill-transparent stroke-[rgb(var(--vgc-border-rgb,39_39_42))]" strokeWidth="26" />

              {filtered.map((item, index) => {
                const angle = (item.value / total) * 360;
                const startAngle = cursor;
                const endAngle = cursor + angle;
                cursor = endAngle;

                return (
                  <path
                    key={item.label}
                    d={donutPath(80, 80, 70, 44, startAngle, endAngle)}
                    fill={colors[index % colors.length]}
                  />
                );
              })}

              <circle cx="80" cy="80" r="40" className="fill-[rgb(var(--vgc-surface-rgb,9_9_11))]" />
              <text x="80" y="76" textAnchor="middle" className="fill-[rgb(var(--vgc-text-rgb,244_244_245))] text-[18px] font-bold">
                {valueFormatter(total)}
              </text>
              <text x="80" y="96" textAnchor="middle" className="fill-[rgb(var(--vgc-muted-rgb,161_161_170))] text-[10px]">
                Total
              </text>
            </svg>
          </div>

          <div className="space-y-2">
            {filtered.map((item, index) => (
              <div key={item.label} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: colors[index % colors.length] }} />
                  <span className="min-w-0 truncate">{item.label}</span>
                </div>

                <span className="shrink-0 whitespace-nowrap text-right font-semibold tabular-nums">{valueFormatter(item.value)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}


export default function ReportsPage() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [timeframe, setTimeframe] = useState<Timeframe>("year");
  const [tab, setTab] = useState<"overview" | "duplicates" | "metadata" | "checkedout" | "analytics">("overview");
  const [message, setMessage] = useState("");

  const duplicateGroups = analytics?.duplicateGroups || [];
  const metadata = analytics?.metadata || null;
  const totals = useMemo(() => analytics?.summary || null, [analytics]);

  async function load() {
    setMessage("");

    try {
      const [reportData, dashboardResult] = await Promise.all([
        api<{ analytics: Analytics }>("/reports/summary"),
        api<DashboardData>(`/dashboard-data?timeframe=${timeframe}`)
      ]);

      setAnalytics(reportData.analytics);
      setDashboardData(dashboardResult);
    } catch (err: any) {
      setMessage(err.message || "Failed to load reports.");
    }
  }

  async function loadDashboardData(nextTimeframe: Timeframe) {
    setMessage("");

    try {
      const dashboardResult = await api<DashboardData>(`/dashboard-data?timeframe=${nextTimeframe}`);
      setDashboardData(dashboardResult);
    } catch (err: any) {
      setMessage(err.message || "Failed to load chart data.");
    }
  }

  function changeTimeframe(nextTimeframe: Timeframe) {
    setTimeframe(nextTimeframe);
    loadDashboardData(nextTimeframe);
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <Shell>
      <Card>
        <SectionHeader
          icon={<BarChart3 className="h-6 w-6" />}
          title="Reports"
          description="Analytics, duplicate detection, and metadata quality checks across collections you can access."
        />

        <div className="flex flex-wrap gap-2">
          {[
            ["overview", "Overview"],
            ["duplicates", "Duplicates"],
            ["metadata", "Metadata Quality"]
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setTab(value as any)}
              className={`rounded-xl border px-4 py-2 text-sm ${tab === value ? "vgc-accent-border vgc-accent-text" : "border-zinc-700 text-zinc-300"}`}
            >
              {label}
            </button>
          ))}

          <a
            href="/assets"
            className="rounded-xl border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:vgc-accent-border hover:vgc-accent-text"
          >
            Asset Tags
          </a>

          {[
            ["checkedout", "Checked Out"],
            ["analytics", "Advanced Analytics"]
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setTab(value as any)}
              className={`rounded-xl border px-4 py-2 text-sm ${tab === value ? "vgc-accent-border vgc-accent-text" : "border-zinc-700 text-zinc-300"}`}
            >
              {label}
            </button>
          ))}
        </div>

        {message && <p className="mt-4 rounded-lg bg-zinc-800 p-3 text-sm">{message}</p>}
      </Card>

      {!analytics && !message && (
        <Card className="mt-6">
          <p className="text-sm text-zinc-400">Loading reports...</p>
        </Card>
      )}

      {analytics && tab === "overview" && totals && (
        <div className="mt-6 space-y-6">
          {dashboardData && (
            <div className="grid gap-6 lg:grid-cols-2 2xl:grid-cols-3">
              <DonutChart
                title="Collection Breakdown"
                items={[
                  { label: "Games", value: dashboardData.summary.games },
                  { label: "Systems", value: dashboardData.summary.systems },
                  { label: "Peripherals", value: dashboardData.summary.peripherals },
                  { label: "Toys-to-life", value: dashboardData.summary.toysToLife }
                ]}
              />

              <DonutChart
                title="Price by Collection"
                items={
                  dashboardData.valueByCollection && dashboardData.valueByCollection.length > 0
                    ? dashboardData.valueByCollection
                    : [
                        { label: "Total Current Value", value: dashboardData.summary.totalCurrentValue }
                      ]
                }
                valueFormatter={money}
              />

              <DonutChart
                title="Items by Collection"
                items={
                  dashboardData.collectionBreakdown && dashboardData.collectionBreakdown.length > 0
                    ? dashboardData.collectionBreakdown
                    : [
                        { label: "Collections", value: dashboardData.summary.collections },
                        { label: "Games", value: dashboardData.summary.games },
                        { label: "Systems", value: dashboardData.summary.systems },
                        { label: "Peripherals", value: dashboardData.summary.peripherals },
                        { label: "Toys-to-life", value: dashboardData.summary.toysToLife }
                      ]
                }
              />
            </div>
          )}

          <Card>
            <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="flex items-start gap-3">
                <TrendingUp className="mt-1 h-6 w-6 vgc-accent-text" />
                <div>
                  <h2 className="text-xl font-bold">Value Trend</h2>
                  <p className="vgc-muted text-sm text-zinc-400">
                    Total Current Value and Gain / Loss over time, based on when items were added.
                  </p>
                </div>
              </div>

              <label className="block md:w-48">
                <span className="mb-1 block text-sm font-medium">Timeframe</span>
                <select
                  className="vgc-select"
                  style={{ colorScheme: "light" }}
                  value={timeframe}
                  onChange={(e) => changeTimeframe(e.target.value as Timeframe)}
                >
                  {timeframeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="mb-4 flex flex-wrap gap-4 text-sm">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-[rgb(var(--vgc-accent-rgb,59_130_246))]" />
                <span>Total Current Value</span>
              </div>

              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-[rgb(var(--vgc-chart-secondary-rgb,34_197_94))]" />
                <span>Gain / Loss</span>
              </div>
            </div>

            {dashboardData ? (
              <LineChart data={dashboardData.timeline} />
            ) : (
              <p className="rounded-xl border border-dashed border-zinc-700 p-8 text-center text-zinc-400">
                Loading chart...
              </p>
            )}
          </Card>
          <div className="grid gap-4 md:grid-cols-4">
            <StatCard label="Collections" value={totals.collections} />
            <StatCard label="Games" value={totals.games} />
            <StatCard label="Systems" value={totals.systems} />
            <StatCard label="Peripherals" value={totals.peripherals} />
            <StatCard label="Toys-to-life" value={totals.toysToLife} />
            <StatCard label="Asset Tags" value={totals.assetTags} />
            <StatCard label="Checked Out" value={totals.loanedItems} tone={totals.loanedItems > 0 ? "warn" : "default"} />
            <StatCard label="Duplicate Groups" value={totals.duplicateGroups} tone={totals.duplicateGroups > 0 ? "warn" : "good"} />
            <StatCard label="Total Price Paid" value={money(totals.totalPricePaid)} />
            <StatCard label="Total Current Value" value={money(totals.totalCurrentValue)} />
            <StatCard label="Gain / Loss" value={`${totals.gainLoss >= 0 ? "+" : ""}${money(totals.gainLoss)}`} tone={totals.gainLoss >= 0 ? "good" : "bad"} />
            <StatCard label="Metadata Warnings" value={totals.metadataWarnings} tone={totals.metadataWarnings > 0 ? "warn" : "good"} />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <SectionHeader icon={<TrendingUp className="h-5 w-5" />} title="Value by Platform" description="Current value grouped by normalized platform names." />
              <BarList rows={analytics.valueByPlatform} moneyValues />
            </Card>

            <Card>
              <SectionHeader icon={<Copy className="h-5 w-5" />} title="Top Value Items" description="Highest current value items across accessible collections." />
              <div className="space-y-3">
                {analytics.topValueItems.slice(0, 10).map((item) => (
                  <a key={`${item.kind}-${item.title}-${item.collectionName}`} href={item.url} className="block rounded-xl border border-zinc-800 bg-zinc-950 p-3 hover:vgc-accent-border">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold">{item.title}</div>
                        <div className="text-sm text-zinc-400">{item.platform} · {item.collectionName}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">{money(item.currentValue)}</div>
                        <div className={item.gainLoss >= 0 ? "text-sm text-green-300" : "text-sm text-red-300"}>
                          {item.gainLoss >= 0 ? "+" : ""}{money(item.gainLoss)}
                        </div>
                      </div>
                    </div>
                  </a>
                ))}
                {analytics.topValueItems.length === 0 && <p className="text-sm text-zinc-400">No value data yet.</p>}
              </div>
            </Card>
          </div>
        </div>
      )}

      {analytics && tab === "duplicates" && (
        <div className="mt-6 space-y-6">
          <Card>
            <SectionHeader icon={<Copy className="h-6 w-6" />} title="Duplicate Detection" description="Potential duplicates found by barcode, normalized game title + platform, and normalized item identity." />

            {duplicateGroups.length === 0 ? (
              <p className="rounded-xl border border-dashed border-zinc-700 p-8 text-center text-zinc-400">No duplicate groups found.</p>
            ) : (
              <div className="space-y-4">
                {duplicateGroups.map((group) => (
                  <div key={`${group.type}-${group.key}`} className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
                    <div className="mb-3 flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="font-semibold">{group.type.toUpperCase()} duplicate</div>
                        <div className="text-sm text-zinc-400">{group.count} matching records</div>
                      </div>
                      <div className="break-all font-mono text-xs text-zinc-500">{group.key}</div>
                    </div>

                    <div className="grid gap-3">
                      {group.items.map((item) => (
                        <a key={`${group.key}-${item.kind}-${item.id}`} href={`/collections/${item.collectionId}`} className="rounded-xl border border-zinc-800 bg-zinc-900 p-3 hover:vgc-accent-border">
                          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                            <div>
                              <div className="font-semibold">{item.title}</div>
                              <div className="text-sm text-zinc-400">{item.platform || "Unknown platform"} · {item.collectionName}</div>
                            </div>
                            <div className="text-left text-sm md:text-right">
                              {item.assetTag && <div className="font-mono vgc-accent-text">{item.assetTag}</div>}
                              {item.barcode && <div className="text-zinc-400">Barcode: {item.barcode}</div>}
                              <div className={item.status.startsWith("Checked out") ? "text-red-300" : "text-green-300"}>{item.status}</div>
                            </div>
                          </div>
                        </a>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {analytics && tab === "metadata" && metadata && (
        <div className="mt-6 space-y-6">
          <div className="grid gap-4 md:grid-cols-4">
            <StatCard label="Missing Barcodes" value={metadata.summary.missingBarcodes} tone={metadata.summary.missingBarcodes > 0 ? "warn" : "good"} />
            <StatCard label="Missing Images" value={metadata.summary.missingImages} tone={metadata.summary.missingImages > 0 ? "warn" : "good"} />
            <StatCard label="Missing Values" value={metadata.summary.missingValues} tone={metadata.summary.missingValues > 0 ? "warn" : "good"} />
            <StatCard label="Platform Alias Groups" value={metadata.summary.platformAliasGroups} tone={metadata.summary.platformAliasGroups > 0 ? "warn" : "good"} />
          </div>

          <Card>
            <SectionHeader icon={<DatabaseZap className="h-6 w-6" />} title="Platform Normalization" description="Different platform spellings grouped into normalized names." />
            {metadata.platformAliasGroups.length === 0 ? (
              <p className="text-sm text-zinc-400">No platform alias conflicts found.</p>
            ) : (
              <div className="grid gap-3">
                {metadata.platformAliasGroups.map((group) => (
                  <div key={group.normalized} className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
                    <div className="font-semibold">{group.normalized}</div>
                    <div className="mt-1 text-sm text-zinc-400">{group.variants.join(", ")}</div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <SectionHeader icon={<AlertTriangle className="h-6 w-6" />} title="Metadata Warnings" description="Items missing useful tracking, value, or identification metadata." />
            <div className="space-y-3">
              {metadata.suggestions.map((item) => (
                <div key={`${item.kind}-${item.id}`} className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
                  <div className="font-semibold">{item.title}</div>
                  <div className="text-sm text-zinc-400">{item.collectionName}</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {item.warnings.map((warning) => (
                      <span key={warning} className="rounded-full border border-amber-700 px-2 py-1 text-xs text-amber-300">{warning}</span>
                    ))}
                  </div>
                </div>
              ))}
              {metadata.suggestions.length === 0 && <p className="text-sm text-zinc-400">No metadata warnings found.</p>}
            </div>
          </Card>
        </div>
      )}

      {analytics && tab === "checkedout" && (
        <div className="mt-6 space-y-6">
          <Card>
            <SectionHeader
              icon={<AlertTriangle className="h-6 w-6" />}
              title="Checked Out Items"
              description="Currently loaned assets across collections you can access."
            />

            <div className="grid gap-4 md:grid-cols-3">
              <StatCard
                label="Currently Checked Out"
                value={analytics.loanedItems.length}
                tone={analytics.loanedItems.length > 0 ? "warn" : "good"}
              />
              <StatCard
                label="Total Asset Tags"
                value={analytics.summary.assetTags}
              />
              <StatCard
                label="Available Tagged Items"
                value={Math.max(analytics.summary.assetTags - analytics.loanedItems.length, 0)}
                tone="good"
              />
            </div>
          </Card>

          <Card>
            {analytics.loanedItems.length === 0 ? (
              <p className="rounded-xl border border-dashed border-zinc-700 p-8 text-center text-zinc-400">
                No items are currently checked out.
              </p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {analytics.loanedItems.map((item) => (
                  <a
                    key={`${item.assetTag || item.title}-${item.borrowerName}`}
                    href={item.url}
                    className="rounded-xl border border-zinc-800 bg-zinc-950 p-4 hover:vgc-accent-border"
                  >
                    <div className="flex flex-col gap-2">
                      <div>
                        <div className="text-xs uppercase tracking-wide text-zinc-500">
                          {item.kind.replaceAll("_", " ")}
                        </div>
                        <div className="font-semibold">{item.title}</div>
                        <div className="text-sm text-zinc-400">{item.collectionName}</div>
                      </div>

                      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 text-sm">
                        <div className="text-red-300">Checked out to {item.borrowerName}</div>
                        {item.dueAt && (
                          <div className="mt-1 text-zinc-400">
                            Due: {new Date(item.dueAt).toLocaleDateString()}
                          </div>
                        )}
                        {item.assetTag && (
                          <div className="mt-1 font-mono text-sm vgc-accent-text">
                            {item.assetTag}
                          </div>
                        )}
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {analytics && tab === "analytics" && (
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Card>
            <SectionHeader icon={<TrendingUp className="h-5 w-5" />} title="Spend by Platform" description="Total price paid grouped by normalized platform." />
            <BarList rows={analytics.spendByPlatform} moneyValues />
          </Card>
          <Card>
            <SectionHeader icon={<TrendingUp className="h-5 w-5" />} title="Value by Collection" description="Current value grouped by collection." />
            <BarList rows={analytics.valueByCollection} moneyValues />
          </Card>
          <Card>
            <SectionHeader icon={<BarChart3 className="h-5 w-5" />} title="Item Count by Platform" description="Inventory count grouped by normalized platform." />
            <BarList rows={analytics.countByPlatform} />
          </Card>
          <Card>
            <SectionHeader icon={<BarChart3 className="h-5 w-5" />} title="Condition Breakdown" description="Tracked parts and items grouped by condition." />
            <BarList rows={analytics.conditionBreakdown} />
          </Card>
        </div>
      )}
    </Shell>
  );
}
