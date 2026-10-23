import type { Stamp, TicketView } from "@/convex/gameTypes";
import { PROCESS_MS, ROUTE_COOLDOWN_MS } from "@/convex/gameTypes";
import { formatMoney, formatSeconds } from "@/lib/format";
import { STAMP_META } from "./stamps";

type TicketCardProps = {
  ticket: TicketView;
  now: number;
  myStamps: Stamp[];
  processingName: string | null;
  shaking: boolean;
  /** True while the player already has a ticket on their desk. */
  busy: boolean;
  onAct: (ticket: TicketView) => void;
};

export function TicketCard({
  ticket,
  now,
  myStamps,
  processingName,
  shaking,
  busy,
  onAct,
}: TicketCardProps) {
  const meta = STAMP_META[ticket.type];
  const mine = myStamps.includes(ticket.type);
  const processing = ticket.state === "processing";

  const total = Math.max(1, ticket.deadline - ticket.spawnAt);
  const remainingMs = Math.max(0, ticket.deadline - now);
  const fraction = Math.max(0, Math.min(1, remainingMs / total));
  const seconds = formatSeconds(remainingMs);
  const barColor =
    fraction > 0.5 ? "bg-billing" : fraction > 0.22 ? "bg-ops" : "bg-alert";

  const cooldownMs =
    ticket.lastRoutedAt != null
      ? Math.max(0, ticket.lastRoutedAt + ROUTE_COOLDOWN_MS - now)
      : 0;

  const processProgress =
    processing && ticket.claimAt != null
      ? Math.max(0, Math.min(1, (now - ticket.claimAt) / PROCESS_MS))
      : 0;

  const hint = processing
    ? `${processingName ?? "Someone"} is clearing it`
    : mine
      ? busy
        ? "Finish the ticket on your desk first"
        : "Tap to clear"
      : cooldownMs > 0
        ? `Routed · again in ${Math.ceil(cooldownMs / 1000)}s`
        : "Tap to route +5s";

  return (
    <button
      type="button"
      onClick={() => onAct(ticket)}
      disabled={processing}
      aria-label={`${meta.label}: ${ticket.subject}, ${formatMoney(ticket.value)}`}
      className={`relative w-full rounded-2xl border-2 border-ink/80 bg-paper-card p-3 text-left transition ${
        processing
          ? "opacity-80"
          : "shadow-[3px_4px_0_0_rgba(33,30,26,0.15)] active:translate-y-[1px] active:shadow-[2px_2px_0_0_rgba(33,30,26,0.15)] sm:hover:-translate-y-0.5 sm:hover:shadow-[4px_6px_0_0_rgba(33,30,26,0.17)]"
      } ${shaking ? "animate-inbox-shake" : ""}`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`flex w-11 shrink-0 flex-col items-center gap-0.5 rounded-lg border px-1 py-1.5 ${meta.border} ${meta.bg}`}
        >
          <span className="text-base leading-none" aria-hidden="true">
            {meta.icon}
          </span>
          <span
            className={`text-[7px] font-bold uppercase tracking-[0.06em] ${meta.text}`}
          >
            {meta.label}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[14.5px] font-semibold leading-snug text-ink">
            {ticket.subject}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-mono text-[13px] font-bold">
              {formatMoney(ticket.value)}
            </span>
            {mine && !processing ? (
              <span className="rounded-sm border border-ink/25 px-1 py-px text-[8px] font-bold uppercase tracking-[0.12em] text-ink-soft">
                Your stamp
              </span>
            ) : null}
            {ticket.routeCount > 0 ? (
              <span className="text-[9px] uppercase tracking-[0.1em] text-ink-soft">
                routed ×{ticket.routeCount}
              </span>
            ) : null}
          </div>
        </div>

        <div className="shrink-0 text-right">
          <div
            className={`font-mono text-lg font-bold leading-none tabular-nums ${
              seconds <= 8 && !processing ? "text-alert" : "text-ink"
            }`}
          >
            {seconds}
            <span className="text-[10px]">s</span>
          </div>
          <div className="mt-0.5 text-[8px] uppercase tracking-[0.14em] text-ink-soft">
            {processing ? "on desk" : "left"}
          </div>
        </div>
      </div>

      <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-ink/10">
        <div
          className={`h-full rounded-full ${processing ? "bg-support" : barColor}`}
          style={{
            width: `${(processing ? processProgress : fraction) * 100}%`,
            transition: "width 200ms linear",
          }}
        />
      </div>

      <div className="mt-1.5 flex items-center justify-between gap-2">
        <span className="truncate text-[9px] font-semibold uppercase tracking-[0.14em] text-ink-soft">
          {hint}
        </span>
        <span className="shrink-0 text-[9px] uppercase tracking-[0.12em] text-ink-soft/80">
          {processing
            ? `${Math.round(processProgress * 100)}%`
            : mine
              ? meta.label
              : "Route"}
        </span>
      </div>
    </button>
  );
}
