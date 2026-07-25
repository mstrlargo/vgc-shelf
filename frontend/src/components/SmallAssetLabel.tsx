"use client";

import { AssetTagLite, User } from "@/lib/api";
import { Branding } from "@/lib/branding";

export function qrUrlForTag(tag: string) {
  if (typeof window === "undefined") return "";

  const url = `${window.location.origin}/assets/${encodeURIComponent(tag)}`;
  return `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(url)}`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function labelTextFor(branding: Branding) {
  return branding.labelText?.trim() || branding.appName?.trim() || "VGC Shelf";
}

function labelMarkup(assetTag: AssetTagLite, user: User | null, branding: Branding) {
  const appName = escapeHtml(labelTextFor(branding));
  const tag = escapeHtml(assetTag.tag);
  const ownerName = escapeHtml(user?.name || user?.email || "Owner");
  const ownerEmail = escapeHtml(user?.email || "");
  const qrUrl = qrUrlForTag(assetTag.tag);

  return `
    <div class="label">
      <img class="qr" src="${qrUrl}" alt="QR code" />
      <div class="text">
        <div class="app">${appName}</div>
        <div class="tag">${tag}</div>
        <div class="owner">${ownerName}</div>
        <div class="email">${ownerEmail}</div>
      </div>
    </div>
  `;
}

export function printAssetLabels({
  assetTags,
  user,
  branding
}: {
  assetTags: AssetTagLite[];
  user: User | null;
  branding: Branding;
}) {
  if (typeof window === "undefined" || assetTags.length === 0) return false;

  const printWindow = window.open("", "_blank", "width=900,height=700");

  if (!printWindow) {
    window.print();
    return false;
  }

  const title = assetTags.length === 1 ? assetTags[0].tag : `${assetTags.length} asset labels`;
  const labelWidth = Math.min(6, Math.max(0.5, Number(branding.assetLabelWidth) || 2.25));
  const labelHeight = Math.min(6, Math.max(0.5, Number(branding.assetLabelHeight) || 1));
  const padding = Math.max(0.05, Math.min(0.12, labelHeight * 0.08));
  const gap = Math.max(0.05, Math.min(0.12, labelHeight * 0.08));
  const qrSize = Math.max(0.35, Math.min(labelHeight - padding * 2, labelWidth * 0.42));
  const scale = Math.max(0.8, Math.min(1.5, labelHeight));

  printWindow.document.open();
  printWindow.document.write(`
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    @page {
      size: ${labelWidth}in ${labelHeight}in;
      margin: 0;
    }

    html,
    body {
      margin: 0;
      padding: 0;
      background: white;
      color: black;
      font-family: Arial, Helvetica, sans-serif;
    }

    .label {
      box-sizing: border-box;
      width: ${labelWidth}in;
      height: ${labelHeight}in;
      padding: ${padding}in;
      display: flex;
      align-items: center;
      gap: ${gap}in;
      overflow: hidden;
      border: 1px solid #ddd;
      break-after: page;
      page-break-after: always;
    }

    .label:last-child {
      break-after: auto;
      page-break-after: auto;
    }

    .qr {
      width: ${qrSize}in;
      height: ${qrSize}in;
      flex: 0 0 auto;
    }

    .text {
      min-width: 0;
      overflow: hidden;
      line-height: 1.1;
    }

    .app {
      font-size: ${8 * scale}px;
      font-weight: 700;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .tag {
      margin-top: 2px;
      font-family: "Courier New", monospace;
      font-size: ${10 * scale}px;
      font-weight: 700;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .owner {
      margin-top: 2px;
      font-size: ${7 * scale}px;
      font-weight: 700;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .email {
      margin-top: 1px;
      font-size: ${6.5 * scale}px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    @media screen {
      body {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        padding: 16px;
      }

      .label {
        break-after: auto;
        page-break-after: auto;
      }
    }

    @media print {
      body {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }
  </style>
</head>
<body>
  ${assetTags.map((assetTag) => labelMarkup(assetTag, user, branding)).join("\n")}
  <script>
    window.addEventListener("load", function () {
      setTimeout(function () {
        window.focus();
        window.print();
      }, 500);
    });
  </script>
</body>
</html>
  `);
  printWindow.document.close();
  return true;
}

export function printAssetLabel({
  assetTag,
  user,
  branding
}: {
  assetTag: AssetTagLite;
  user: User | null;
  branding: Branding;
}) {
  return printAssetLabels({ assetTags: [assetTag], user, branding });
}

export function SmallAssetLabel({
  assetTag,
  user,
  branding
}: {
  assetTag: AssetTagLite;
  user: User | null;
  branding: Branding;
}) {
  const labelWidth = Math.min(6, Math.max(0.5, Number(branding.assetLabelWidth) || 2.25));
  const labelHeight = Math.min(6, Math.max(0.5, Number(branding.assetLabelHeight) || 1));
  const previewWidth = 288;
  const previewHeight = Math.max(90, previewWidth * (labelHeight / labelWidth));

  return (
    <div
      className="print-label rounded border border-zinc-300 bg-white p-2 text-zinc-950"
      style={{ width: "100%", maxWidth: previewWidth, minHeight: previewHeight }}
    >
      <div className="flex items-center gap-2">
        <img src={qrUrlForTag(assetTag.tag)} alt={`QR ${assetTag.tag}`} className="h-16 w-16" />
        <div className="min-w-0">
          <div className="truncate text-[10px] font-bold leading-tight">{labelTextFor(branding)}</div>
          <div className="truncate font-mono text-[12px] font-bold leading-tight">{assetTag.tag}</div>
          <div className="truncate text-[9px] leading-tight">{user?.name || user?.email || "Owner"}</div>
          <div className="truncate text-[8px] leading-tight">{user?.email || ""}</div>
        </div>
      </div>
    </div>
  );
}
