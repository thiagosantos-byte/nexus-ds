import { useEffect, useRef, useState } from "react";
/** One monotonic clock drives every reveal. Browser visibility pauses the show. */
export function useCeremonyClock(duration: number) {
  const [elapsed, setElapsed] = useState(0),
    [paused, setPaused] = useState(false),
    [iteration, setIteration] = useState(0);
  const clock = useRef(0);
  useEffect(() => {
    if (paused || clock.current >= duration) return;
    let frame = 0,
      last = performance.now(),
      painted = last;
    const tick = (now: number) => {
      clock.current = Math.min(
        duration,
        clock.current + Math.max(0, now - last),
      );
      last = now;
      if (now - painted >= 80 || clock.current === duration) {
        setElapsed(clock.current);
        painted = now;
      }
      if (clock.current < duration) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [paused, duration, iteration]);
  useEffect(() => {
    const hide = () => {
      if (document.hidden) setPaused(true);
    };
    document.addEventListener("visibilitychange", hide);
    return () => document.removeEventListener("visibilitychange", hide);
  }, []);
  return {
    elapsed,
    paused,
    setPaused,
    done: elapsed >= duration,
    skip: () => {
      clock.current = duration;
      setElapsed(duration);
      setPaused(false);
    },
    replay: () => {
      clock.current = 0;
      setElapsed(0);
      setPaused(false);
      setIteration((value) => value + 1);
    },
    iteration,
  };
}
