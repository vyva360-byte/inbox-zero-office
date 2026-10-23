const NAME_KEY = "inboxzero:name";
const ID_KEY = "inboxzero:player-id";

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Private-mode storage can fail; the game still works for this tab.
  }
}

export function getStoredName(): string {
  return read(NAME_KEY) ?? "";
}

export function rememberName(name: string) {
  write(NAME_KEY, name.trim().slice(0, 14));
}

/** Stable per-browser player id. No accounts — just a local name tag. */
export function getPlayerId(): string {
  const existing = read(ID_KEY);
  if (existing) return existing;
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `staff-${Math.random().toString(36).slice(2)}-${Date.now()}`;
  write(ID_KEY, id);
  return id;
}
