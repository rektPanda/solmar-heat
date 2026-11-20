// Seeded RNG (mulberry32) + gaussian helper. Deterministic per seed so a
// fresh load always builds the same city and the same traffic pattern.
export function makeRng(seed) {
  let a = seed >>> 0;
  const next = () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  let spare = null;
  return {
    next,
    int(min, max) {
      return min + Math.floor(next() * (max - min + 1));
    },
    range(min, max) {
      return min + next() * (max - min);
    },
    pick(arr) {
      return arr[Math.floor(next() * arr.length)];
    },
    // Box-Muller gaussian, mean 0, std 1, clamped by the caller.
    gauss() {
      if (spare !== null) {
        const v = spare;
        spare = null;
        return v;
      }
      let u = 0;
      let v = 0;
      while (u === 0) u = next();
      v = next();
      const mag = Math.sqrt(-2 * Math.log(u));
      spare = mag * Math.sin(2 * Math.PI * v);
      return mag * Math.cos(2 * Math.PI * v);
    },
    gaussClamped(mean, std, lo, hi) {
      const v = mean + this.gauss() * std;
      return Math.max(lo, Math.min(hi, v));
    },
  };
}
