import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import type { PlayerView, RoomView } from "@/convex/gameTypes";
import { formatClock, formatMoney } from "@/lib/format";
import { useMutation } from "convex/react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

const GRADE_TONE: Record<string, string> = {
  S: "border-[#a3760a] text-[#a3760a]",
  A: "border-billing text-billing",
  B: "border-support text-support",
  C: "border-ops text-ops",
  D: "border-alert text-alert",
};

export function ResultsView({ room, me }: { room: RoomView; me: PlayerView }) {
  const navigate = useNavigate();
  const playAgain = useMutation(api.game.playAgain);
  const [busy, setBusy] = useState(false);

  const survived = room.foldedAt == null;
  const grade = room.grade ?? "D";
  const foldedIn =
    room.foldedAt != null && room.startAt != null
      ? room.foldedAt - room.startAt
      : null;

  async function handlePlayAgain() {
    if (busy) return;
    setBusy(true);
    try {
      const result = await playAgain({
        code: room.code,
        playerId: me.id,
      });
      if (!result.ok) toast("Couldn't call the next shift.");
    } catch {
      toast("Couldn't call the next shift. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const stats = [
    { label: "Revenue", value: formatMoney(room.revenue) },
    { label: "Company Health", value: `${room.health}/100` },
    { label: "Cleared", value: String(room.resolvedCount) },
    { label: "Dropped", value: String(room.expiredCount) },
  ];

  return (
    <main className="mx-auto w-full max-w-2xl px-4 pb-14 pt-8">
      <p className="text-center text-[9px] font-semibold uppercase tracking-[0.26em] text-ink-soft">
        Shift report · Room {room.code}
      </p>
      <h1 className="mt-2 text-center font-display text-3xl leading-tight tracking-tight sm:text-4xl">
        {survived ? "The company survived." : "The company folded."}
      </h1>
      <p className="mt-1.5 text-center text-sm text-ink-soft">
        {survived
          ? "Five minutes. Everyone still employed."
          : `Company Health hit zero at ${formatClock(foldedIn ?? 0)}.`}
      </p>

      <div className="mt-8 flex justify-center">
        <div
          className={`relative grid size-32 -rotate-6 animate-stamp-in place-items-center rounded-full border-[6px] border-double bg-paper-card/60 ${
            GRADE_TONE[grade] ?? GRADE_TONE.D
          }`}
        >
          <span className="font-display text-6xl leading-none">{grade}</span>
          <span className="absolute -bottom-2 bg-paper px-1.5 text-[8px] font-bold uppercase tracking-[0.3em] text-ink-soft">
            Grade
          </span>
        </div>
      </div>

      {room.chaos ? (
        <div className="mt-5 flex justify-center">
          <span className="rotate-[-1.5deg] border border-alert/50 bg-alert/10 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-alert">
            Chaos Gremlins
          </span>
        </div>
      ) : null}

      <dl className="mt-7 grid grid-cols-2 gap-2.5">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-2xl border-2 border-ink/20 bg-paper-card p-3.5"
          >
            <dt className="text-[9px] font-semibold uppercase tracking-[0.2em] text-ink-soft">
              {stat.label}
            </dt>
            <dd className="mt-1 font-mono text-2xl font-bold leading-none">
              {stat.value}
            </dd>
          </div>
        ))}
      </dl>

      <div className="mt-7 space-y-2">
        <Button
          type="button"
          onClick={() => void handlePlayAgain()}
          disabled={busy}
          className="w-full rounded-2xl border-2 border-ink bg-ink py-3.5 text-[12px] font-bold uppercase tracking-[0.2em] text-paper-card shadow-[3px_3px_0_0_rgba(33,30,26,0.3)] transition hover:bg-ink/90 disabled:opacity-40"
        >
          {busy ? "Calling the shift…" : "Play again"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => navigate("/")}
          className="w-full rounded-2xl border-2 border-ink/60 bg-paper-card py-3.5 text-[12px] font-bold uppercase tracking-[0.2em] text-ink hover:bg-paper-deep"
        >
          New room
        </Button>
      </div>
      <p className="mt-3 text-center text-[9px] font-semibold uppercase tracking-[0.16em] text-ink-soft/80">
        Play again keeps this room and its staff
      </p>
    </main>
  );
}
