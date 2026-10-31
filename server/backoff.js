/** Exponential delay with a little jitter. `failures` is 1-based. */
export function nextDelay(failures, base, max, rand = Math.random) {
  const exp = Math.min(max, base * 2 ** Math.max(0, failures - 1));
  const jitter = exp * 0.2 * rand();
  return Math.round(exp + jitter);
}
