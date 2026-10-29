import { useEffect, useState } from "react";
import type { Result } from "../workspace/types";
import { resultVersion, seenKey } from "./model";
const changed = "nexus:podium-seen";
const legacyPrefix = "catapimba:podium:v1:";
const nexusPrefix = "nexus:podium:v1:";
const memory = new Map<string, string>();
export function hasSeen(userId: string, institutionId: string, result: Result) {
  const key = seenKey(userId, institutionId, result.event_id);
  const legacy = key.replace(nexusPrefix, legacyPrefix);
  try {
    return (
      localStorage.getItem(key) === resultVersion(result) ||
      localStorage.getItem(legacy) === resultVersion(result) ||
      memory.get(key) === resultVersion(result)
    );
  } catch {
    return memory.get(key) === resultVersion(result);
  }
}
export function markSeen(
  userId: string,
  institutionId: string,
  result: Result,
) {
  const key = seenKey(userId, institutionId, result.event_id),
    version = resultVersion(result);
  memory.set(key, version);
  try {
    localStorage.setItem(key, version);
  } catch {
    /* Session-only fallback when storage is unavailable. */
  }
  window.dispatchEvent(new Event(changed));
}
export function useCeremonySeen(userId: string, institutionId: string) {
  const [, refresh] = useState(0);
  useEffect(() => {
    const onChange = () => refresh((value) => value + 1);
    window.addEventListener(changed, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(changed, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);
  return (result: Result) => hasSeen(userId, institutionId, result);
}
