import clsx from "clsx";

export function Button({
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={clsx(
        "vgc-accent-bg inline-flex min-h-12 items-center justify-center rounded-xl px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-11 sm:px-6 sm:py-2.5",
        "max-sm:w-full",
        className
      )}
    />
  );
}
