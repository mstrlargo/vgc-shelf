"use client";

import { X } from "lucide-react";

export function Modal({
  title,
  children,
  onClose,
  maxWidth = "max-w-2xl"
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  maxWidth?: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center overflow-hidden bg-black/70 p-0 sm:items-center sm:p-4">
      <div
        className={`flex max-h-[94dvh] w-full ${maxWidth} flex-col rounded-t-2xl border border-zinc-800 bg-zinc-950 shadow-2xl sm:max-h-[92vh] sm:rounded-2xl`}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-zinc-800 px-4 py-3 sm:px-5 sm:py-4">
          <h2 className="min-w-0 pr-3 text-xl font-bold sm:text-2xl">{title}</h2>

          <button
            onClick={onClose}
            className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl border border-zinc-700 p-2 text-zinc-300 hover:bg-zinc-800 sm:min-h-10 sm:min-w-10"
            aria-label="Close modal"
            type="button"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-5">
          {children}
        </div>
      </div>
    </div>
  );
}
