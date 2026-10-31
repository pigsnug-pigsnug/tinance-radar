let ctx = null;
let armed = false;
const played = new Set();

export function audioArmed() {
  return armed;
}

export function armAudioOnGesture() {
  const arm = () => {
    try {
      if (!ctx) ctx = new AudioContext();
      if (ctx.state === 'suspended') ctx.resume();
      armed = ctx.state === 'running';
    } catch {
      armed = false;
    }
  };
  window.addEventListener('pointerdown', arm);
}

export function pingAlert(alert) {
  const key = `${alert.itemId}|${alert.word}`;
  if (played.has(key)) return;
  played.add(key);
  const live = document.getElementById('live');
  if (live) live.textContent = `Watch word ${alert.word} on ${alert.source}: ${alert.title}`;
  if (!armed || !ctx) return;
  const start = ctx.currentTime;
  [880, 1318].forEach((freq, index) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const at = start + index * 0.09;
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(0.05, at + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.18);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(at);
    osc.stop(at + 0.2);
  });
}
