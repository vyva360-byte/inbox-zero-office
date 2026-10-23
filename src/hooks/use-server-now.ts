import { useEffect, useRef, useState } from "react";

/**
 * A clock aligned to the server. The offset from the latest snapshot is stored
 * in an effect, then a local interval advances the clock so timer bars move
 * smoothly between polls.
 */
export function useServerNow(serverNow: number, intervalMs = 200): number {
  const [now, setNow] = useState(serverNow);
  const offsetRef = useRef(0);

  useEffect(() => {
    offsetRef.current = serverNow - Date.now();
  }, [serverNow]);

  useEffect(() => {
    const id = window.setInterval(() => {
      setNow(Date.now() + offsetRef.current);
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);

  return now;
}
