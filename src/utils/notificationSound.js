let audioContext = null;

export function initAudioContext() {
  if (!audioContext && typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext)) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioContext;
}

function playSingleBeep(context, volume, delay = 0) {
  setTimeout(() => {
    const now = context.currentTime;
    const oscillator1 = context.createOscillator();
    const oscillator2 = context.createOscillator();
    const gainNode = context.createGain();

    oscillator1.connect(gainNode);
    oscillator2.connect(gainNode);
    gainNode.connect(context.destination);

    oscillator1.type = 'sine';
    oscillator2.type = 'sine';

    oscillator1.frequency.setValueAtTime(900, now);
    oscillator2.frequency.setValueAtTime(1200, now);

    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(volume * 0.95, now + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.4);

    oscillator1.start(now);
    oscillator2.start(now);

    oscillator1.stop(now + 0.4);
    oscillator2.stop(now + 0.4);
  }, delay);
}

export function playNotificationBeep(volume = 1.0, repeatCount = 3) {
  const context = initAudioContext();
  if (!context) {
    console.warn('Web Audio API not supported');
    return;
  }

  if (context.state === 'suspended') {
    context.resume();
  }

  for (let i = 0; i < repeatCount; i++) {
    const delay = i * 500;
    playSingleBeep(context, volume, delay);

    setTimeout(() => {
      const now2 = context.currentTime;
      const osc1b = context.createOscillator();
      const osc2b = context.createOscillator();
      const gainNode2 = context.createGain();

      osc1b.connect(gainNode2);
      osc2b.connect(gainNode2);
      gainNode2.connect(context.destination);

      osc1b.type = 'sine';
      osc2b.type = 'sine';

      osc1b.frequency.setValueAtTime(1100, now2);
      osc2b.frequency.setValueAtTime(1400, now2);

      gainNode2.gain.setValueAtTime(0, now2);
      gainNode2.gain.linearRampToValueAtTime(volume * 0.9, now2 + 0.02);
      gainNode2.gain.exponentialRampToValueAtTime(0.01, now2 + 0.35);

      osc1b.start(now2);
      osc2b.start(now2);

      osc1b.stop(now2 + 0.35);
      osc2b.stop(now2 + 0.35);
    }, delay + 200);
  }
}

export function testNotificationSound() {
  playNotificationBeep(1.0, 3);
}
