// SOLMAR BAY — procedural WebAudio only. No audio files: every sound is
// synthesised (engine hum, sirens, gunshots, pickup blips, UI clicks).
// Audio starts on the first user gesture; M toggles mute.
export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenLfo = null;

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
    } catch { return false; }
  }
  function unlock() {
    if (ensure() && ctx.state === 'suspended') ctx.resume().catch(() => {});
  }
  function tone(freq, dur, type, vol, slideTo) {
    if (!ensure() || muted) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain); gain.connect(master);
    osc.start(t); osc.stop(t + dur + 0.02);
  }
  function noise(dur, vol, filterFreq) {
    if (!ensure() || muted) return;
    const t = ctx.currentTime;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq || 1800;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter); filter.connect(gain); gain.connect(master);
    src.start(t);
  }

  return {
    unlock,
    isMuted() { return muted; },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    click() { tone(660, 0.07, 'square', 0.12); },
    pickup() { tone(880, 0.09, 'sine', 0.2); setTimeout(() => tone(1320, 0.12, 'sine', 0.18), 70); },
    cash() { tone(1046, 0.08, 'triangle', 0.2); setTimeout(() => tone(1568, 0.14, 'triangle', 0.2), 80); },
    gunshot() { noise(0.14, 0.5, 2600); tone(160, 0.1, 'square', 0.25, 60); },
    crash() { noise(0.25, 0.4, 900); tone(90, 0.2, 'sawtooth', 0.2, 45); },
    horn() { tone(370, 0.22, 'square', 0.14); tone(466, 0.22, 'square', 0.1); },
    sirenStart() {
      if (!ensure() || muted || sirenOsc) return;
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'sine';
      sirenOsc.frequency.value = 750;
      sirenLfo = ctx.createOscillator();
      sirenLfo.type = 'sine';
      sirenLfo.frequency.value = 0.55;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 260;
      sirenLfo.connect(lfoGain); lfoGain.connect(sirenOsc.frequency);
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0.05;
      sirenOsc.connect(sirenGain); sirenGain.connect(master);
      sirenOsc.start(); sirenLfo.start();
    },
    sirenStop() {
      try { if (sirenOsc) sirenOsc.stop(); if (sirenLfo) sirenLfo.stop(); } catch { /* already stopped */ }
      sirenOsc = null; sirenLfo = null; sirenGain = null;
    },
    // Continuous engine hum; call every frame with speed 0..1 (0 = off).
    engine(speed, on) {
      if (!ensure()) return;
      if (!on || muted || speed <= 0.01) {
        if (engineOsc) { try { engineOsc.stop(); } catch { /* noop */ } engineOsc = null; engineGain = null; }
        return;
      }
      if (!engineOsc) {
        engineOsc = ctx.createOscillator();
        engineOsc.type = 'sawtooth';
        engineGain = ctx.createGain();
        engineGain.gain.value = 0.03;
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass'; filter.frequency.value = 700;
        engineOsc.connect(filter); filter.connect(engineGain); engineGain.connect(master);
        engineOsc.start();
      }
      engineOsc.frequency.setTargetAtTime(55 + speed * 130, ctx.currentTime, 0.08);
      engineGain.gain.setTargetAtTime(0.02 + speed * 0.05, ctx.currentTime, 0.1);
    },
  };
}
