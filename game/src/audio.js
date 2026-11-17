// Tiny WebAudio synth: engine hum, siren, gunshot, crash, pickup, jingles.
// Everything is generated — no audio files, no network.
export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenPhase = 0;
  let muted = false;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      return true;
    } catch (e) { return false; }
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (!ctx || muted) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), ctx.currentTime + dur);
    g.gain.setValueAtTime(vol || 0.2, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.connect(g); g.connect(master);
    o.start(); o.stop(ctx.currentTime + dur + 0.02);
  }

  function noise(dur, vol, filterFreq) {
    if (!ctx || muted) return;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = filterFreq || 1200;
    const g = ctx.createGain();
    g.gain.value = vol || 0.3;
    src.connect(f); f.connect(g); g.connect(master);
    src.start();
  }

  return {
    unlock() { if (ensure() && ctx.state === 'suspended') ctx.resume(); },
    setMuted(m) { muted = m; if (master) master.gain.value = m ? 0 : 0.5; },
    isMuted() { return muted; },
    engine(on, speed01) {
      if (!ensure() || muted) { if (engineGain) engineGain.gain.value = 0; return; }
      if (!engineOsc) {
        engineOsc = ctx.createOscillator();
        engineOsc.type = 'sawtooth';
        engineGain = ctx.createGain();
        engineGain.gain.value = 0;
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass'; f.frequency.value = 700;
        engineOsc.connect(f); f.connect(engineGain); engineGain.connect(master);
        engineOsc.start();
      }
      const target = on ? 0.05 + speed01 * 0.06 : 0;
      engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.08);
      engineOsc.frequency.setTargetAtTime(55 + speed01 * 130, ctx.currentTime, 0.1);
    },
    siren(on, dt) {
      if (!ensure()) return;
      if (on && !muted) {
        if (!sirenOsc) {
          sirenOsc = ctx.createOscillator();
          sirenOsc.type = 'square';
          sirenGain = ctx.createGain();
          sirenGain.gain.value = 0.035;
          sirenOsc.connect(sirenGain); sirenGain.connect(master);
          sirenOsc.start();
        }
        sirenPhase += dt;
        sirenOsc.frequency.value = (Math.floor(sirenPhase / 0.45) % 2 === 0) ? 680 : 920;
      } else if (sirenOsc) {
        try { sirenOsc.stop(); } catch (e) {}
        sirenOsc.disconnect(); sirenOsc = null; sirenGain = null;
      }
    },
    shot() { noise(0.12, 0.5, 2400); tone(180, 0.08, 'square', 0.18, 60); },
    crash() { noise(0.25, 0.4, 500); tone(110, 0.25, 'sine', 0.3, 40); },
    pickup() { tone(660, 0.09, 'sine', 0.2); setTimeout(() => tone(990, 0.12, 'sine', 0.2), 70); },
    complete() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.22, 'triangle', 0.22), i * 110)); },
    busted() { [392, 330, 262].forEach((f, i) => setTimeout(() => tone(f, 0.3, 'triangle', 0.2), i * 160)); },
    click() { tone(880, 0.05, 'sine', 0.12); },
    // Two-tone car horn (H key) and a door thunk for getting in/out.
    horn() { tone(370, 0.16, 'square', 0.14); tone(466, 0.16, 'square', 0.14); },
    door() { noise(0.09, 0.25, 300); tone(90, 0.1, 'sine', 0.25, 50); },
    step() { noise(0.04, 0.05, 900); },
  };
}
