export function money(value: unknown) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value || 0));
}

export function deltaLabel(current: unknown, paid: unknown) {
  const delta = Number(current || 0) - Number(paid || 0);
  if (!Number.isFinite(delta) || (!current && !paid)) return null;
  return { text: `${delta >= 0 ? "+" : ""}${money(delta)}`, className: delta >= 0 ? "text-green-300" : "text-red-300" };
}
