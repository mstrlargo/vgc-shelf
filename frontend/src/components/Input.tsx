import type { InputHTMLAttributes } from "react";
import clsx from "clsx";

type Props = InputHTMLAttributes<HTMLInputElement>;

export function Input({ className = "", ...props }: Props) {
  return (
    <input
      className={clsx(
        "w-full min-h-11 rounded-xl border border-zinc-700 bg-white px-3 py-2.5 text-base text-zinc-950 outline-none ring-indigo-500 focus:ring-2 sm:min-h-10 sm:py-2 sm:text-sm",
        className
      )}
      {...props}
    />
  );
}
