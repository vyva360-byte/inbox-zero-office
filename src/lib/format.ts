/** 4:07 style clock. */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function formatMoney(value: number): string {
  return `$${value.toLocaleString("en-US")}`;
}

export function formatSeconds(ms: number): number {
  return Math.max(0, Math.ceil(ms / 1000));
}
