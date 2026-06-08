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

export function printAssetLabel({
  assetTag,
  user,
  branding
}: {
  assetTag: AssetTagLite;
  user: User | null;
  branding: Branding;
}) {
  if (typeof window === "undefined") return;

  const printWindow = window.open("", "_blank", "width=420,height=320");

  if (!printWindow) {
    window.print();
    return;
  }

  const appName = escapeHtml(labelTextFor(branding));
  const tag = escapeHtml(assetTag.tag);
  const ownerName = escapeHtml(user?.name || user?.email || "Owner");
  const ownerEmail = escapeHtml(user?.email || "");
  const qrUrl = qrUrlForTag(assetTag.tag);

  printWindow.document.open();
  printWindow.document.write(`
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${tag}</title>
  <style>
    @page {
      size: 2.25in 1in;
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
      width: 2.25in;
      height: 1in;
      padding: 0.08in;
      display: flex;
      align-items: center;
      gap: 0.08in;
      overflow: hidden;
      border: 1px solid #ddd;
    }

    .qr {
      width: 0.78in;
      height: 0.78in;
      flex: 0 0 auto;
    }

    .text {
      min-width: 0;
      overflow: hidden;
      line-height: 1.1;
    }

    .app {
      font-size: 8px;
      font-weight: 700;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .tag {
      margin-top: 2px;
      font-family: "Courier New", monospace;
      font-size: 10px;
      font-weight: 700;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .owner {
      margin-top: 2px;
      font-size: 7px;
      font-weight: 700;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .email {
      margin-top: 1px;
      font-size: 6.5px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
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
  <div class="label">
    <img class="qr" src="${qrUrl}" alt="QR code" />
    <div class="text">
      <div class="app">${appName}</div>
      <div class="tag">${tag}</div>
      <div class="owner">${ownerName}</div>
      <div class="email">${ownerEmail}</div>
    </div>
  </div>
  <script>
    window.addEventListener("load", function () {
      setTimeout(function () {
        window.focus();
        window.print();
      }, 250);
    });
  </script>
</body>
</html>
  `);
  printWindow.document.close();
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
  return (
    <div className="print-label rounded border border-zinc-300 bg-white p-2 text-zinc-950">
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
