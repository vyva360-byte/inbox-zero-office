import { formatClock, formatMoney } from "@/lib/format";

type TopBarProps = {
  health: number;
  revenue: number;
  remainingMs: number;
  phaseName: string;
  code: string;
};

export function TopBar({ health, revenue, remainingMs, phaseName, code }: TopBarProps) {
  const danger = remainingMs <= 60_000;
  const healthTone =
    health > 50 ? "bg-billing" : health > 25 ? "bg-ops" : "bg-alert";

  return (
    <header className="sticky top-0 z-30 border-b-2 border-ink bg-paper-card/95 backdrop-blur-sm">
      <div className="mx-auto w-full max-w-3xl px-3 pb-2.5 pt-2">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.22em] text-ink-soft">
              <span
                className={`size-1.5 rounded-full ${danger ? "animate-pulse bg-alert" : "bg-billing"}`}
              />
              <span className="truncate">{phaseName}</span>
            </div>
            <div
              className={`font-mono text-[30px] font-bold leading-none tracking-tight tabular-nums ${
                danger ? "text-alert" : "text-ink"
              }`}
            >
              {formatClock(remainingMs)}
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-[9px] font-semibold uppercase tracking-[0.22em] text-ink-soft">
              Revenue
            </div>
            <div className="font-mono text-lg font-bold leading-tight">
              {formatMoney(revenue)}
            </div>
            <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink-soft">
              Room {code}
            </div>
          </div>
        </div>

        <div className="mt-2">
          <div className="flex items-baseline justify-between">
            <span className="text-[9px] font-semibold uppercase tracking-[0.22em] text-ink-soft">
              Company Health
            </span>
            <span
              className={`font-mono text-xs font-bold tabular-nums ${
                health <= 25 ? "text-alert" : "text-ink"
              }`}
            >
              {health}/100
            </span>
          </div>
          <div
            className="mt-1 h-2.5 overflow-hidden rounded-full border border-ink/25 bg-paper-deep"
            role="meter"
            aria-label="Company Health"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={health}
          >
            <div
              className={`h-full rounded-full ${healthTone} transition-[width] duration-300 ease-out`}
              style={{ width: `${Math.max(0, Math.min(100, health))}%` }}
            />
          </div>
        </div>
      </div>
    </header>
  );
}
