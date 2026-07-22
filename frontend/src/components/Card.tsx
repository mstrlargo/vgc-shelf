import type { HTMLAttributes } from "react";
import clsx from "clsx";

type Props = HTMLAttributes<HTMLDivElement>;

export function Card({ className = "", ...props }: Props) {
  return (
    <div
      className={clsx(
        "vgc-card vgc-surface rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5 shadow-xl sm:p-6 lg:p-7",
        className
      )}
      {...props}
    />
  );
}
