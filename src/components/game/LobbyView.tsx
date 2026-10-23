import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import type { PlayerView, RoomView } from "@/convex/gameTypes";
import { MAX_PLAYERS, MIN_PLAYERS } from "@/convex/gameTypes";
import { useMutation } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { RulesCard } from "./RulesCard";
import { STAMP_META } from "./stamps";

type LobbyViewProps = {
  room: RoomView;
  me: PlayerView;
};

export function LobbyView({ room, me }: LobbyViewProps) {
  const startShift = useMutation(api.game.startShift);
  const rerollStamps = useMutation(api.game.rerollStamps);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (copiedTimer.current !== null) window.clearTimeout(copiedTimer.current);
    },
    [],
  );

  const enoughStaff = room.players.length >= MIN_PLAYERS;

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(room.code);
      setCopied(true);
      if (copiedTimer.current !== null) window.clearTimeout(copiedTimer.current);
      copiedTimer.current = window.setTimeout(() => setCopied(false), 1600);
    } catch {
      toast("Copy failed — read the code out loud instead.");
    }
  }

  async function handleStart() {
    if (busy) return;
    setBusy(true);
    try {
      const result = await startShift({ code: room.code, playerId: me.id });
      if (!result.ok) {
        toast(
          result.reason === "need_players"
            ? "The shift needs at least one more staffer."
            : "Couldn't start the shift.",
        );
      }
    } catch {
      toast("Couldn't start the shift. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleReroll() {
    try {
      const result = await rerollStamps({ code: room.code, playerId: me.id });
      if (!result.ok) toast("Only the boss can re-roll stamps.");
    } catch {
      toast("Couldn't re-roll stamps.");
    }
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 pb-14 pt-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-[0.24em] text-ink-soft">
            Inbox Zero
          </p>
          <h1 className="font-display text-xl leading-tight">The Five-Minute Office</h1>
        </div>
        <span className="rounded-full border border-ink/25 bg-paper-card px-2.5 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.18em]">
          Lobby
        </span>
      </div>

      <div className="mt-5 rounded-2xl border-2 border-ink bg-paper-card p-4 shadow-[4px_4px_0_0_rgba(33,30,26,0.15)]">
        <div className="flex items-center justify-between">
          <span className="text-[9px] font-semibold uppercase tracking-[0.22em] text-ink-soft">
            Room code
          </span>
          <button
            type="button"
            onClick={() => void copyCode()}
            className="text-[10px] font-bold uppercase tracking-[0.14em] underline decoration-dotted underline-offset-4"
          >
            {copied ? "Copied" : "Copy code"}
          </button>
        </div>
        <div className="mt-2 flex gap-1.5">
          {room.code.split("").map((character, index) => (
            <span
              key={`${character}-${index}`}
              className="grid h-14 flex-1 place-items-center rounded-lg border-2 border-ink/70 bg-paper font-mono text-2xl font-bold"
            >
              {character}
            </span>
          ))}
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-ink-soft">
          Send a coworker to this page and have them enter the code. Up to{" "}
          {MAX_PLAYERS} staff.
        </p>
      </div>

      <div className="mt-3 rounded-2xl border-2 border-ink/25 bg-paper-card p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[9px] font-bold uppercase tracking-[0.22em] text-ink-soft">
            Staff ({room.players.length}/{MAX_PLAYERS})
          </h2>
          {me.isHost ? (
            <button
              type="button"
              onClick={() => void handleReroll()}
              className="text-[10px] font-bold uppercase tracking-[0.12em] underline decoration-dotted underline-offset-4"
            >
              Re-roll stamps
            </button>
          ) : null}
        </div>

        <ul className="mt-1.5 divide-y divide-ink/10">
          {room.players.map((player) => (
            <li key={player.id} className="flex items-start gap-3 py-2.5">
              <div className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full border border-ink/25 bg-paper font-mono text-[11px] font-bold">
                {player.name.slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="truncate text-sm font-semibold">
                    {player.name}
                  </span>
                  {player.id === me.id ? (
                    <span className="rounded-sm bg-ink px-1 py-px text-[8px] font-bold uppercase tracking-[0.1em] text-paper-card">
                      You
                    </span>
                  ) : null}
                  {player.isHost ? (
                    <span className="rounded-sm border border-ink/30 px-1 py-px text-[8px] font-bold uppercase tracking-[0.1em] text-ink-soft">
                      Boss
                    </span>
                  ) : null}
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {player.stamps.map((stamp) => {
                    const meta = STAMP_META[stamp];
                    return (
                      <span
                        key={stamp}
                        className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.06em] ${meta.border} ${meta.bg} ${meta.text}`}
                      >
                        <span aria-hidden="true">{meta.icon}</span>
                        {meta.label}
                      </span>
                    );
                  })}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-4">
        {me.isHost ? (
          <>
            <Button
              type="button"
              onClick={() => void handleStart()}
              disabled={!enoughStaff || busy}
              className="h-14 w-full rounded-2xl border-2 border-ink bg-ink text-[12px] font-bold uppercase tracking-[0.2em] text-paper-card shadow-[3px_3px_0_0_rgba(33,30,26,0.3)] transition hover:bg-ink/90 disabled:opacity-40 sm:hover:translate-y-px sm:hover:shadow-[2px_2px_0_0_rgba(33,30,26,0.3)]"
            >
              {busy ? "Starting…" : "Start shift"}
            </Button>
            {!enoughStaff ? (
              <p className="mt-2 text-center text-[11px] text-ink-soft">
                At least {MIN_PLAYERS} staff needed. Send the code to a coworker.
              </p>
            ) : (
              <p className="mt-2 text-center text-[10px] uppercase tracking-[0.16em] text-ink-soft/80">
                Five minutes. One shared inbox.
              </p>
            )}
          </>
        ) : (
          <div className="rounded-2xl border-2 border-dashed border-ink/25 bg-paper-card/50 px-4 py-5 text-center">
            <p className="text-sm font-semibold">Waiting for the boss…</p>
            <p className="mt-1 text-[11px] text-ink-soft">
              The shift starts when they hit Start Shift.
            </p>
          </div>
        )}
      </div>

      <div className="mt-6 rounded-2xl border-2 border-ink/20 bg-paper-card/60 p-4">
        <RulesCard />
      </div>
    </main>
  );
}
