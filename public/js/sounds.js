let _ctx = null;

function ctx() {
  if (!_ctx) _ctx = new (window.AudioContext || window.webkitAudioContext)();
  return _ctx;
}

function tone(freq, start, duration, vol, type = 'sine') {
  const ac = ctx();
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.connect(gain);
  gain.connect(ac.destination);
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(vol, start + 0.04);
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration - 0.04);
  osc.start(start);
  osc.stop(start + duration);
}

export function playAlert(style = 'gradual', volume = 70) {
  if (style === 'silent') return;
  const vol = Math.max(0.01, volume / 100);
  const ac = ctx();
  const now = ac.currentTime;

  if (style === 'gradual') {
    // Três notas crescendo em volume
    [[440, 0.25], [550, 0.6], [660, 0.9]].forEach(([freq, factor], i) => {
      tone(freq, now + i * 0.55, 0.8, vol * factor);
    });
  } else if (style === 'chime') {
    // Acorde suave (triângulo)
    [523.25, 659.25, 783.99].forEach((freq, i) => {
      tone(freq, now + i * 0.28, 1.1, vol * 0.8, 'triangle');
    });
  } else if (style === 'bell') {
    // Sino único com decay longo
    const ac2 = ctx();
    const osc = ac2.createOscillator();
    const gain = ac2.createGain();
    osc.connect(gain); gain.connect(ac2.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(440, now + 2);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(vol, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 2.5);
    osc.start(now); osc.stop(now + 2.5);
  }
}

export function testAlert(style, volume) {
  // Resumir contexto suspenso (necessário após interação do usuário)
  if (_ctx && _ctx.state === 'suspended') _ctx.resume();
  playAlert(style, volume);
}
