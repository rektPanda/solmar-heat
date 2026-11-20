// WebAudio synth only — no audio files, no network. Everything is an
// oscillator/noise burst built at runtime. The context is created lazily on
// the first user gesture (browsers block audio before that).
export function makeAudio() {
  let ctx = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenTimer = 0;

  function ensure() {
    if (ctx) return ctx;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 320;
      engineOsc.connect(lp);
      lp.connect(engineGain);
      engineGain.connect(ctx.destination);
      engineOsc.start();
    } catch {
      ctx = null;
    }
    return ctx;
  }

  function blip(freq, dur, type, vol, slideTo) {
    const c = ensure();
    if (!c) return;
    try {
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, c.currentTime);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, c.currentTime + dur);
      g.gain.setValueAtTime(vol, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
      o.connect(g);
      g.connect(c.destination);
      o.start();
      o.stop(c.currentTime + dur + 0.02);
    } catch {
      /* audio is cosmetic; never crash the game */
    }
  }

  function noise(dur, vol, freq) {
    const c = ensure();
    if (!c) return;
    try {
      const len = Math.max(1, Math.floor(c.sampleRate * dur));
      const buf = c.createBuffer(1, len, c.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = c.createBufferSource();
      src.buffer = buf;
      const f = c.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = freq;
      const g = c.createGain();
      g.gain.value = vol;
      src.connect(f);
      f.connect(g);
      g.connect(c.destination);
      src.start();
    } catch {
      /* cosmetic */
    }
  }

  return {
    unlock() {
      ensure();
    },
    setEngine(speed01) {
      if (!ctx || !engineOsc || !engineGain) return;
      try {
        engineOsc.frequency.value = 52 + speed01 * 130;
        engineGain.gain.value = speed01 > 0.02 ? 0.035 + speed01 * 0.03 : 0;
      } catch {
        /* cosmetic */
      }
    },
    shot() {
      noise(0.12, 0.5, 2400);
    },
    reload() {
      blip(520, 0.07, 'square', 0.08);
      setTimeout(() => blip(760, 0.07, 'square', 0.08), 120);
    },
    horn() {
      blip(340, 0.28, 'square', 0.12, 330);
      blip(428, 0.28, 'square', 0.08, 415);
    },
    door() {
      noise(0.09, 0.25, 900);
      blip(190, 0.08, 'triangle', 0.12);
    },
    pickup() {
      blip(660, 0.09, 'sine', 0.16);
      setTimeout(() => blip(990, 0.14, 'sine', 0.16), 90);
    },
    cash() {
      blip(880, 0.1, 'sine', 0.16);
      setTimeout(() => blip(1174, 0.1, 'sine', 0.16), 100);
      setTimeout(() => blip(1568, 0.18, 'sine', 0.16), 200);
    },
    busted() {
      blip(392, 0.22, 'sawtooth', 0.14, 196);
      setTimeout(() => blip(196, 0.4, 'sawtooth', 0.14, 98), 220);
    },
    // Two-tone siren, throttled by the caller (dt accumulated here).
    siren(dt, on) {
      if (!on) return;
      sirenTimer -= dt;
      if (sirenTimer > 0) return;
      sirenTimer = 0.85;
      blip(740, 0.38, 'sine', 0.05, 980);
      setTimeout(() => blip(980, 0.38, 'sine', 0.05, 740), 400);
    },
  };
}
