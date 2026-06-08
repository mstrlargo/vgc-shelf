"use client";

import { useEffect } from "react";

export default function DashboardRedirectPage() {
  useEffect(() => {
    window.location.href = "/collections";
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-6 text-zinc-100">
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 text-sm text-zinc-300">
        Redirecting to collections...
      </div>
    </main>
  );
}
