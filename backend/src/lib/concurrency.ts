// A plain sequential loop over N (class, subject) units — each needing its
// own round trip to a remote database — is what made the institution-wide
// export take the better part of a minute instead of the roadmap's
// required under-10-seconds (docs/decisions.md, Phase 9). This runs at
// most `limit` requests concurrently, capped below the pool's own max
// connection count (10, db/client.ts) so an export never starves other
// requests of a connection.
export async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;

  async function worker() {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}
