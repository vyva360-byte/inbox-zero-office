import { RulesCard } from "@/components/game/RulesCard";
import { STAMP_META } from "@/components/game/stamps";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/convex/_generated/api";
import { STAMPS } from "@/convex/gameTypes";
import { getPlayerId, getStoredName, rememberName } from "@/lib/identity";
import { useMutation } from "convex/react";
import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router";

export default function Landing() {
  const navigate = useNavigate();
  const createRoom = useMutation(api.game.createRoom);

  const [name, setName] = useState(getStoredName());
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  function validateName(): string | null {
    const trimmed = name.replace(/\s+/g, " ").trim();
    if (trimmed.length === 0) {
      setError("Add your name first — the staff list needs it.");
      return null;
    }
    rememberName(trimmed);
    return trimmed;
  }

  async function handleCreate() {
    const validName = validateName();
    if (validName === null) return;

    setError(null);
    setCreating(true);
    try {
      const code = await createRoom({
        playerId: getPlayerId(),
        name: validName,
      });
      navigate(`/room/${code}`);
    } catch {
      setError("Couldn't open a room. Give it another go.");
      setCreating(false);
    }
  }

  function handleJoin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = joinCode.trim().toUpperCase();
    if (trimmed.length !== 4) {
      setError("Room codes are exactly four letters.");
      return;
    }
    if (validateName() === null) return;
    setError(null);
    navigate(`/room/${trimmed}`);
  }

  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink paper-grain">
      <header className="border-b border-ink/15">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-8">
          <div className="flex items-baseline gap-2.5">
            <span className="font-display text-base font-bold tracking-tight">
              INBOX ZERO
            </span>
            <span className="hidden text-[9px] font-semibold uppercase tracking-[0.22em] text-ink-soft sm:inline">
              The Five-Minute Office
            </span>
          </div>
          <a
            href="#rules"
            className="text-[9px] font-semibold uppercase tracking-[0.2em] text-ink-soft underline decoration-dotted underline-offset-4 transition hover:text-ink"
          >
            How it works
          </a>
        </div>
      </header>

      <main className="flex-1">
        <section className="mx-auto grid w-full max-w-6xl gap-10 px-4 pb-12 pt-8 sm:px-8 sm:pt-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-14 lg:pt-16">
          <div>
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[9px] font-semibold uppercase tracking-[0.2em] text-ink-soft">
              <span>Co-op party game</span>
              <span className="text-ink/30">/</span>
              <span>2–6 players</span>
              <span className="text-ink/30">/</span>
              <span>5 minutes</span>
            </p>

            <h1 className="relative mt-3 font-display text-[clamp(3.4rem,10vw,6.5rem)] font-bold leading-[0.82] tracking-[-0.035em]">
              INBOX
              <br />
              ZERO
              <span className="absolute -right-1 top-0 hidden rotate-[7deg] rounded-md border-[3px] border-alert px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-alert sm:inline-block lg:-right-4">
                5:00 flat
              </span>
            </h1>

            <p className="mt-5 max-w-md text-[15px] leading-relaxed text-ink/90">
              Your team is the whole staff. Five minutes. One inbox. Don&apos;t
              let it burn.
            </p>

            <div className="mt-7 rounded-2xl border-2 border-ink bg-paper-card p-4 shadow-[5px_5px_0_0_rgba(33,30,26,0.16)] sm:p-5">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-bold uppercase tracking-[0.22em] text-ink-soft">
                  Get a room
                </span>
                <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink-soft">
                  No accounts
                </span>
              </div>

              <label
                htmlFor="player-name"
                className="mt-3 block text-[10px] font-bold uppercase tracking-[0.16em] text-ink-soft"
              >
                Your name
              </label>
              <Input
                id="player-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={14}
                placeholder="e.g. Vic"
                autoComplete="nickname"
                className="mt-1 h-12 rounded-xl border-2 border-ink/40 bg-paper px-3 text-base focus-visible:border-ink focus-visible:ring-0"
              />

              <Button
                type="button"
                onClick={() => void handleCreate()}
                disabled={creating}
                className="mt-2 h-12 w-full rounded-xl border-2 border-ink bg-ink text-[11px] font-bold uppercase tracking-[0.2em] text-paper-card shadow-[2px_2px_0_0_rgba(33,30,26,0.35)] transition hover:bg-ink/90 disabled:opacity-50"
              >
                {creating ? "Opening the office…" : "Create room"}
              </Button>

              <div className="my-4 flex items-center gap-3 text-[9px] font-semibold uppercase tracking-[0.18em] text-ink-soft">
                <span className="h-px flex-1 bg-ink/15" />
                or join a shift
                <span className="h-px flex-1 bg-ink/15" />
              </div>

              <form onSubmit={handleJoin} className="flex gap-2">
                <Input
                  value={joinCode}
                  onChange={(event) =>
                    setJoinCode(
                      event.target.value
                        .toUpperCase()
                        .replace(/[^A-Z]/g, "")
                        .slice(0, 4),
                    )
                  }
                  maxLength={4}
                  placeholder="CODE"
                  aria-label="Four-letter room code"
                  autoCapitalize="characters"
                  autoComplete="off"
                  spellCheck={false}
                  className="h-12 min-w-0 flex-1 rounded-xl border-2 border-ink/40 bg-paper px-3 text-center font-mono text-lg font-bold uppercase tracking-[0.4em] placeholder:tracking-[0.3em] placeholder:text-ink/25 focus-visible:border-ink focus-visible:ring-0"
                />
                <Button
                  type="submit"
                  variant="outline"
                  className="h-12 rounded-xl border-2 border-ink bg-paper px-5 text-[11px] font-bold uppercase tracking-[0.16em] text-ink hover:bg-paper-deep"
                >
                  Join
                </Button>
              </form>

              {error ? (
                <p role="alert" className="mt-2 text-[11px] font-semibold text-alert">
                  {error}
                </p>
              ) : null}
            </div>
          </div>

          <div className="mx-auto w-full max-w-sm pb-8 lg:max-w-none">
            <div className="relative rotate-[1.5deg] rounded-2xl border-2 border-ink/70 bg-paper-card p-4 shadow-[7px_9px_0_0_rgba(33,30,26,0.12)]">
              <div className="flex items-center justify-between border-b border-dashed border-ink/25 pb-2">
                <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink-soft">
                  Ticket #0042 · Ops
                </span>
                <span className="font-mono text-sm font-bold">$140</span>
              </div>
              <div className="mt-3 flex items-start gap-3">
                <div className="grid size-12 shrink-0 place-items-center rounded-lg border border-ops/50 bg-ops/10 text-xl">
                  <span aria-hidden="true">{STAMP_META.ops.icon}</span>
                </div>
                <div className="min-w-0">
                  <p className="font-semibold leading-snug">
                    The printer achieved sentience again
                  </p>
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-soft">
                    22s left · stamp it
                  </p>
                </div>
              </div>
              <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-ink/10">
                <div className="h-full w-[38%] rounded-full bg-ops" />
              </div>

              <div className="pointer-events-none absolute -bottom-4 right-3 rotate-[-8deg] rounded-md border-[3px] border-billing bg-paper-card px-3 py-1 font-mono text-sm font-bold uppercase tracking-[0.18em] text-billing shadow-sm">
                Cleared ✓
              </div>
            </div>

            <div className="mt-8 flex items-center gap-3 rounded-xl border border-ink/20 bg-paper-card/60 px-3 py-2">
              <span className="shrink-0 text-[9px] font-semibold uppercase tracking-[0.18em] text-ink-soft">
                Company health
              </span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-ink/10">
                <div className="h-full w-[70%] rounded-full bg-billing" />
              </div>
              <span className="font-mono text-[11px] font-bold">70</span>
            </div>

            <div className="mt-3 flex items-center justify-between font-mono text-[9px] uppercase tracking-[0.18em] text-ink-soft">
              <span>3 stamps</span>
              <span>1 shared inbox</span>
              <span>0 mercy</span>
            </div>
          </div>
        </section>

        <section id="rules" className="border-t border-ink/15 bg-paper-card/40">
          <div className="mx-auto grid w-full max-w-6xl gap-7 px-4 py-10 sm:px-8 lg:grid-cols-[0.8fr_1.2fr] lg:gap-12">
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-[0.24em] text-ink-soft">
                Read before your first day
              </p>
              <h2 className="mt-2 font-display text-3xl leading-tight tracking-tight">
                Your team is the whole staff.
              </h2>
              <p className="mt-3 max-w-sm text-sm leading-relaxed text-ink-soft">
                Two to six people share one inbox. Every ticket needs the right
                stamp, and the clock does not care about your feelings.
              </p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {STAMPS.map((stamp) => {
                  const meta = STAMP_META[stamp];
                  return (
                    <span
                      key={stamp}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[9px] font-bold uppercase tracking-[0.08em] ${meta.border} ${meta.bg} ${meta.text}`}
                    >
                      <span aria-hidden="true">{meta.icon}</span>
                      {meta.label}
                    </span>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl border-2 border-ink/20 bg-paper-card p-5 shadow-[3px_3px_0_0_rgba(33,30,26,0.08)]">
              <RulesCard />
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-8">
          <div className="flex flex-col gap-4 rounded-2xl border-2 border-ink/20 bg-paper-card/60 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-display text-xl leading-tight">
                Five minutes start when the boss hits the button.
              </p>
              <p className="mt-1 text-[12px] text-ink-soft">
                One room code. Everyone on their own phone. No installs.
              </p>
            </div>
            <Button
              type="button"
              onClick={() => void handleCreate()}
              disabled={creating}
              className="h-12 shrink-0 rounded-xl border-2 border-ink bg-ink px-5 text-[11px] font-bold uppercase tracking-[0.18em] text-paper-card transition hover:bg-ink/90 disabled:opacity-50"
            >
              Open a room
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t border-ink/15">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-1 px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p className="font-display text-sm">
            Inbox Zero · The Five-Minute Office
          </p>
          <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink-soft">
            No accounts · no installs · one four-letter code
          </p>
        </div>
      </footer>
    </div>
  );
}
