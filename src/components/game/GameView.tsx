import { useMutation } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { PlayerView, RoomView, TicketView } from "@/convex/gameTypes";
import { PROCESS_MS } from "@/convex/gameTypes";
import { useServerNow } from "@/hooks/use-server-now";
import { formatMoney } from "@/lib/format";
import { STAMP_META } from "./stamps";
import { TicketCard } from "./TicketCard";
import { TopBar } from "./TopBar";

type GameViewProps = {
  room: RoomView;
  me: PlayerView;
};

export function GameView({ room, me }: GameViewProps) {
  const now = useServerNow(room.now);
  const claimTicket = useMutation(api.game.claimTicket);
  const routeTicket = useMutation(api.game.routeTicket);

  const [pendingId, setPendingId] = useState<number | null>(null);
  const [shakingId, setShakingId] = useState<number | null>(null);
  const shakeTimer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (shakeTimer.current !== null) window.clearTimeout(shakeTimer.current);
    },
    [],
  );

  const busy = me.processingTicketId != null;
  const myTicket =
    me.processingTicketId != null
      ? (room.tickets.find((ticket) => ticket.id === me.processingTicketId) ?? null)
      : null;
  const remainingMs = room.endsAt != null ? room.endsAt - now : 0;

  function shake(ticketId: number) {
    if (shakeTimer.current !== null) window.clearTimeout(shakeTimer.current);
    setShakingId(ticketId);
    shakeTimer.current = window.setTimeout(() => setShakingId(null), 450);
  }

  async function handleAct(ticket: TicketView) {
    if (pendingId != null) return;
    const mine = me.stamps.includes(ticket.type);

    if (mine && busy) {
      toast("One ticket at a time. Finish the one on your desk.");
      return;
    }

    setPendingId(ticket.id);
    try {
      if (mine) {
        const result = await claimTicket({
          code: room.code,
          playerId: me.id,
          ticketId: ticket.id,
        });
        if (result.ok) return;
        switch (result.reason) {
          case "taken":
            shake(ticket.id);
            toast("Taken! Another staffer grabbed that one.");
            break;
          case "expired":
            toast("Too late — that ticket dropped.");
            break;
          case "busy":
            toast("One ticket at a time. Finish the one on your desk.");
            break;
          case "wrong_stamp":
            toast("That one isn't your stamp.");
            break;
          default:
            toast("Couldn't clear that ticket.");
        }
      } else {
        const result = await routeTicket({
          code: room.code,
          playerId: me.id,
          ticketId: ticket.id,
        });
        if (result.ok) return;
        switch (result.reason) {
          case "cooldown":
            toast(
              `Already routed. Ready again in ${Math.ceil((result.retryInMs ?? 0) / 1000)}s.`,
            );
            break;
          case "own_stamp":
            toast("That's your stamp — clear it yourself.");
            break;
          case "expired":
            toast("Too late — that ticket dropped.");
            break;
          case "taken":
            toast("Someone already picked that one up.");
            break;
          default:
            toast("Couldn't route that one.");
        }
      }
    } catch {
      toast("The office went quiet. Try that again.");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <>
      <TopBar
        health={room.health}
        revenue={room.revenue}
        remainingMs={remainingMs}
        phaseName={room.phaseName}
        code={room.code}
      />

      <main className="mx-auto w-full max-w-3xl flex-1 px-3 pb-40 pt-3">
        <div className="flex gap-1.5 overflow-x-auto pb-0.5">
          {room.players.map((player) => (
            <div
              key={player.id}
              className={`flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 ${
                player.id === me.id
                  ? "border-ink bg-paper-card shadow-[2px_2px_0_0_rgba(33,30,26,0.12)]"
                  : "border-ink/20 bg-paper-card/60"
              }`}
            >
              <span className="max-w-[92px] truncate text-[11px] font-semibold">
                {player.name}
              </span>
              <span className="flex items-center gap-0.5 text-[11px]">
                {player.stamps.map((stamp) => (
                  <span key={stamp} title={STAMP_META[stamp].label} aria-hidden="true">
                    {STAMP_META[stamp].icon}
                  </span>
                ))}
              </span>
              {player.processingTicketId != null ? (
                <span className="size-1.5 animate-pulse rounded-full bg-support" />
              ) : null}
            </div>
          ))}
        </div>

        <div className="mt-4 flex items-end justify-between gap-3">
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-ink-soft">
              Everyone shares one feed
            </p>
            <h1 className="font-display text-2xl leading-tight tracking-tight">
              Shared inbox
            </h1>
          </div>
          <span className="shrink-0 rounded-full border border-ink/25 bg-paper-card px-2.5 py-1 font-mono text-[11px] font-bold">
            {room.tickets.length} open
          </span>
        </div>

        <div className="mt-3 space-y-2.5">
          {room.tickets.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-ink/25 bg-paper-card/50 px-5 py-9 text-center">
              <p className="font-display text-xl">Inbox zero.</p>
              <p className="mt-1 text-xs text-ink-soft">
                Enjoy it for four seconds.
              </p>
            </div>
          ) : (
            room.tickets.map((ticket) => {
              const claimer = ticket.claimedBy
                ? room.players.find((player) => player.id === ticket.claimedBy)
                : undefined;
              return (
                <TicketCard
                  key={ticket.id}
                  ticket={ticket}
                  now={now}
                  myStamps={me.stamps}
                  processingName={claimer?.name ?? null}
                  shaking={shakingId === ticket.id}
                  busy={busy}
                  onAct={(next) => void handleAct(next)}
                />
              );
            })
          )}
        </div>

        <p className="mt-6 text-center text-[9px] font-semibold uppercase tracking-[0.18em] text-ink-soft/70">
          Clear your stamps · route the rest for +5 seconds
        </p>
      </main>

      {myTicket ? <ProcessingDock ticket={myTicket} now={now} /> : null}
    </>
  );
}

function ProcessingDock({ ticket, now }: { ticket: TicketView; now: number }) {
  const progress =
    ticket.claimAt != null
      ? Math.max(0, Math.min(1, (now - ticket.claimAt) / PROCESS_MS))
      : 0;
  const radius = 17;
  const circumference = 2 * Math.PI * radius;
  const meta = STAMP_META[ticket.type];

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t-2 border-ink bg-paper-card/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-3xl items-center gap-3 px-3 pb-[max(0.9rem,env(safe-area-inset-bottom))] pt-3">
        <div className="relative size-12 shrink-0">
          <svg viewBox="0 0 40 40" className="size-12 -rotate-90">
            <circle
              cx="20"
              cy="20"
              r={radius}
              fill="none"
              stroke="rgba(33,30,26,0.14)"
              strokeWidth="4"
            />
            <circle
              cx="20"
              cy="20"
              r={radius}
              fill="none"
              stroke="#2f5fa8"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - progress)}
            />
          </svg>
          <span className="absolute inset-0 grid place-items-center font-mono text-[10px] font-bold">
            {Math.round(progress * 100)}%
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="text-[9px] font-semibold uppercase tracking-[0.2em] text-ink-soft">
            On your desk · {meta.label}
          </div>
          <p className="truncate text-sm font-semibold">{ticket.subject}</p>
        </div>

        <div className="shrink-0 text-right">
          <div className="font-mono text-sm font-bold">
            {formatMoney(ticket.value)}
          </div>
          <div className="text-[9px] uppercase tracking-[0.14em] text-ink-soft">
            clearing
          </div>
        </div>
      </div>
    </div>
  );
}
