import { useCallback, useEffect, useState } from "react";

// A real bug, found live across four screens (overview, subjects, archive,
// the gradebook's cell-history sheet) and one more with the identical
// shape (the student's own mark-history sheet): `fetcher().then(setState)`
// with no `.catch()` at all. Any transient failure — not hypothetical; a
// 401 racing the very first fetch after login reproduced this at a 50%
// rate in one investigation this session — leaves the rejection unhandled
// and the screen permanently, silently blank, since nothing ever calls
// `setState` again. This hook is the fix applied everywhere that pattern
// showed up: both branches of the settled promise are handled, and `retry`
// (bumping `seq`, which the effect depends on) gives failed screens the
// working "Try again" (`t.scr.err`) that already existed in every locale
// file but was never wired to anything.
// `errorValue` carries the rejection itself alongside the boolean, added
// because discarding it forced any screen that needs to tell one failure from
// another to bypass this hook entirely and reimplement the catch it exists to
// provide. The admissions queue is the first such screen: a 503
// APPLICATIONS_NOT_PROVISIONED (its table has not been created yet, which no
// amount of retrying fixes) has to read differently from a transient failure
// that a "Try again" button can actually resolve. The boolean stays, so every
// existing call site is untouched.
export function useAsyncData<T>(fetcher: () => Promise<T>, deps: readonly unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState(false);
  const [errorValue, setErrorValue] = useState<unknown>(null);
  const [seq, setSeq] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setError(false);
    setErrorValue(null);
    fetcher().then(
      (result) => {
        if (!cancelled) setData(result);
      },
      (err) => {
        if (!cancelled) {
          setErrorValue(err);
          setError(true);
        }
      },
    );
    return () => {
      cancelled = true;
    };
    // `deps` is caller-supplied and intentionally the effect's real
    // dependency list; `seq` re-triggers the same fetch on retry() without
    // the caller having to thread a retry counter through their own deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, seq]);

  const retry = useCallback(() => setSeq((s) => s + 1), []);
  return { data, error, errorValue, retry };
}
