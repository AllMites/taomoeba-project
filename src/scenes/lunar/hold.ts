/**
 * Reference-counted ownership with a deferred release. StrictMode (and React Activity) run an effect's cleanup and
 * then its setup again straight away; releasing GPU memory or a loader cache in that gap would drop resources the
 * still-mounted scene keeps using. A release therefore waits one task and only runs when nothing re-held the key.
 */
const counts = new Map<string, number>();

export function hold(key: string, release: () => void): () => void {
  counts.set(key, (counts.get(key) ?? 0) + 1);
  let done = false;
  return () => {
    if (done) return;
    done = true;
    counts.set(key, (counts.get(key) ?? 1) - 1);
    setTimeout(() => {
      if ((counts.get(key) ?? 0) > 0) return;
      counts.delete(key);
      release();
    }, 0);
  };
}
