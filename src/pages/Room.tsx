import { Button } from "@/components/ui/button";
import { GameView } from "@/components/game/GameView";
import { LobbyView } from "@/components/game/LobbyView";
import { ResultsView } from "@/components/game/ResultsView";
import { Input } from "@/components/ui/input";
import { api } from "@/convex/_generated/api";
import type { JoinResult } from "@/convex/gameTypes";
import { getPlayerId, getStoredName, rememberName } from "@/lib/identity";
import { useMutation, useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { useNavigate, useParams } from "react-router";

function joinErrorMessage(reason: Extract<JoinResult, { ok: false }>["reason"]) {
  switch (reason) {
    case "not_found":
      return "No room with that code. Check the four letters and try again.";
    case "started":
      return "That shift already started. Ask the boss to start a new one.";
    case "full":
      return "That room is full — six staff maximum.";
  }
}

export default function Room() {
  const params = useParams<{ code: string }>();
  const code = (params.code ?? "").toUpperCase();
  const navigate = useNavigate();

  const [pulse, setPulse] = useState(() => Math.floor(Date.now() / 1000));
  const room = useQuery(api.game.getRoom, code.length > 0 ? { code, pulse } : "skip");
  const joinRoom = useMutation(api.game.joinRoom);

  const [identity, setIdentity] = useState(() => ({
    id: getPlayerId(),
    name: getStoredName(),
  }));
  const [joinError, setJoinError] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const joinedKey = useRef<string | null>(null);

  // Poll about once a second. The server rebuilds the shift from timestamps,
  // so this snapshot is always current even after a tab has been asleep.
  useEffect(() => {
    const id = window.setInterval(
      () => setPulse(Math.floor(Date.now() / 1000)),
      1000,
    );
    return () => window.clearInterval(id);
  }, []);

  const me = room?.players.find((player) => player.id === identity.id);

  useEffect(() => {
    if (!room || !identity.name) return;
    if (room.players.some((player) => player.id === identity.id)) return;
    if (room.phase !== "lobby") return;

    const key = `${room.code}:${identity.id}:${identity.name}`;
    if (joinedKey.current === key) return;
    joinedKey.current = key;

    void joinRoom({
      code: room.code,
      playerId: identity.id,
      name: identity.name,
    })
      .then((result) => {
        if (!result.ok) setJoinError(joinErrorMessage(result.reason));
      })
      .catch(() => {
        setJoinError("Couldn't reach the office. Try again.");
      });
  }, [room, identity, joinRoom]);

  function handleNameSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = draftName.replace(/\s+/g, " ").trim().slice(0, 14);
    if (name.length === 0) return;
    rememberName(name);
    setIdentity({ id: getPlayerId(), name });
  }

  let content: ReactNode;

  if (code.length === 0) {
    content = (
      <Notice
        eyebrow="Front desk"
        title="That room code looks short."
        body="Room codes are four letters. Head back and try again."
        onHome={() => navigate("/")}
      />
    );
  } else if (room === null) {
    content = (
      <Notice
        eyebrow="Room not found"
        title={`Nobody is in room ${code}.`}
        body="Check the code with whoever sent it to you, or open a fresh room."
        onHome={() => navigate("/")}
      />
    );
  } else if (room === undefined) {
    content = <Loading />;
  } else if (!identity.name) {
    content = (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-sm rounded-2xl border-2 border-ink bg-paper-card p-5 shadow-[5px_5px_0_0_rgba(33,30,26,0.16)]">
          <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-ink-soft">
            Joining room
          </p>
          <div className="mt-2 flex gap-1.5">
            {code.split("").map((character, index) => (
              <span
                key={`${character}-${index}`}
                className="grid h-10 flex-1 place-items-center rounded-md border border-ink/50 bg-paper font-mono text-lg font-bold"
              >
                {character}
              </span>
            ))}
          </div>
          <h1 className="mt-4 font-display text-2xl leading-tight">
            Who&apos;s clocking in?
          </h1>
          <form onSubmit={handleNameSubmit} className="mt-3">
            <label
              htmlFor="staff-name"
              className="text-[10px] font-bold uppercase tracking-[0.16em] text-ink-soft"
            >
              Your name
            </label>
            <Input
              id="staff-name"
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
              maxLength={14}
              autoFocus
              placeholder="e.g. Vic"
              className="mt-1 h-12 rounded-xl border-2 border-ink/40 bg-paper px-3 text-base focus-visible:border-ink focus-visible:ring-0"
            />
            <Button
              type="submit"
              disabled={draftName.trim().length === 0}
              className="mt-2.5 h-12 w-full rounded-xl border-2 border-ink bg-ink text-[11px] font-bold uppercase tracking-[0.18em] text-paper-card disabled:opacity-40"
            >
              Join the shift
            </Button>
          </form>
        </div>
      </div>
    );
  } else if (!me) {
    content = joinError ? (
      <Notice
        eyebrow="Can't join"
        title="The door is locked."
        body={joinError}
        onHome={() => navigate("/")}
        onRetry={() => {
          joinedKey.current = null;
          setJoinError(null);
        }}
      />
    ) : room.phase === "over" ? (
      <Notice
        eyebrow="Shift over"
        title="That shift already ended."
        body="Ask the staff to open a new room, then join with the fresh code."
        onHome={() => navigate("/")}
      />
    ) : room.phase === "live" ? (
      <Notice
        eyebrow="Shift in progress"
        title="You missed the clock-in."
        body="The inbox is already live for this room. Ask the boss for a new room."
        onHome={() => navigate("/")}
      />
    ) : (
      <Loading label="Clocking in…" />
    );
  } else if (room.phase === "lobby") {
    content = <LobbyView room={room} me={me} />;
  } else if (room.phase === "live") {
    content = <GameView room={room} me={me} />;
  } else {
    content = <ResultsView room={room} me={me} />;
  }

  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink paper-grain">
      {content}
    </div>
  );
}

function Loading({ label = "Opening the office…" }: { label?: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-6">
      <div className="h-1 w-24 overflow-hidden rounded-full bg-ink/10">
        <div className="h-full w-1/2 animate-pulse rounded-full bg-ink/50" />
      </div>
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-soft">
        {label}
      </p>
    </div>
  );
}

function Notice({
  eyebrow,
  title,
  body,
  onHome,
  onRetry,
}: {
  eyebrow: string;
  title: string;
  body: string;
  onHome: () => void;
  onRetry?: () => void;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border-2 border-ink bg-paper-card p-5 shadow-[5px_5px_0_0_rgba(33,30,26,0.16)]">
        <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-ink-soft">
          {eyebrow}
        </p>
        <h1 className="mt-2 font-display text-2xl leading-tight">{title}</h1>
        <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">{body}</p>
        {onRetry ? (
          <Button
            type="button"
            onClick={onRetry}
            className="mt-4 h-12 w-full rounded-xl border-2 border-ink bg-ink text-[11px] font-bold uppercase tracking-[0.18em] text-paper-card"
          >
            Try again
          </Button>
        ) : null}
        <Button
          type="button"
          variant={onRetry ? "ghost" : "default"}
          onClick={onHome}
          className={
            onRetry
              ? "mt-1 h-11 w-full rounded-xl text-[10px] font-bold uppercase tracking-[0.18em] text-ink-soft"
              : "mt-4 h-12 w-full rounded-xl border-2 border-ink bg-ink text-[11px] font-bold uppercase tracking-[0.18em] text-paper-card"
          }
        >
          Back to the front desk
        </Button>
      </div>
    </div>
  );
}
