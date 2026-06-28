// ── Sound system ───────────────────────────────────────────────────────────
let pingAudioContext = null;

function getPingAudioContext() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    return null;
  }

  if (!pingAudioContext) {
    pingAudioContext = new AudioContextClass();
  }

  if (pingAudioContext.state === "suspended") {
    pingAudioContext.resume().catch(() => {});
  }

  return pingAudioContext;
}

function playTapPingSound() {
  const audioContext = getPingAudioContext();
  if (!audioContext) {
    return;
  }

  const now = audioContext.currentTime;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();

  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(880, now);
  oscillator.frequency.exponentialRampToValueAtTime(1320, now + 0.035);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.14, now + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.11);

  oscillator.connect(gain);
  gain.connect(audioContext.destination);

  oscillator.start(now);
  oscillator.stop(now + 0.12);
}

function playMysteryCoinSound() {
  const audioContext = getPingAudioContext();
  if (!audioContext) {
    return;
  }

  const now = audioContext.currentTime;
  const masterGain = audioContext.createGain();
  masterGain.gain.setValueAtTime(0.0001, now);
  masterGain.gain.exponentialRampToValueAtTime(0.22, now + 0.015);
  masterGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.62);
  masterGain.connect(audioContext.destination);

  const coinNotes = [1046, 1318, 1567, 1760, 2093, 2349, 2637];
  for (let i = 0; i < 9; i += 1) {
    const start = now + i * 0.045 + Math.random() * 0.025;
    const duration = 0.10 + Math.random() * 0.08;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const frequency = coinNotes[Math.floor(Math.random() * coinNotes.length)] * (0.92 + Math.random() * 0.18);

    oscillator.type = i % 3 === 0 ? "triangle" : "sine";
    oscillator.frequency.setValueAtTime(frequency, start);
    oscillator.frequency.exponentialRampToValueAtTime(frequency * (1.15 + Math.random() * 0.18), start + duration * 0.4);

    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.11 + Math.random() * 0.07, start + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    oscillator.connect(gain);
    gain.connect(masterGain);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  }

  const lowCoin = audioContext.createOscillator();
  const lowCoinGain = audioContext.createGain();
  lowCoin.type = "square";
  lowCoin.frequency.setValueAtTime(392, now + 0.02);
  lowCoin.frequency.exponentialRampToValueAtTime(740, now + 0.18);
  lowCoinGain.gain.setValueAtTime(0.0001, now + 0.02);
  lowCoinGain.gain.exponentialRampToValueAtTime(0.07, now + 0.04);
  lowCoinGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);
  lowCoin.connect(lowCoinGain);
  lowCoinGain.connect(masterGain);
  lowCoin.start(now + 0.02);
  lowCoin.stop(now + 0.26);
}

function flap() {
  if (!gameStarted || gameOver || gamePaused) {
    return;
  }

  playTapPingSound();

  // Keep taps responsive without stacking overly strong upward boosts.
  bird.velocity = Math.min(bird.velocity, bird.jump);
}



window.addEventListener("pointerdown", event => {
  if (hudPanel.contains(event.target) || gameOverActions.contains(event.target) || pauseGameButton.contains(event.target) || (hundredPhotoModal && hundredPhotoModal.contains(event.target)) || (todayScoresModal && todayScoresModal.contains(event.target))) {
    return;
  }

  if (event.isPrimary) {
    event.preventDefault();
    if (activeUserName && !gameStarted) {
      startGame();
    }
    flap();
  }
}, { passive: false });

document.addEventListener("keydown", e => {
  if (e.code === "Space") {
    if (activeUserName && !gameStarted) {
      startGame();
    }
    flap();
  }
});

function resizeGameForViewportChange() {
  const previousWidth = gameWidth;
  const previousHeight = gameHeight;
  const nextWidth = window.innerWidth;
  const nextHeight = window.innerHeight;
  const widthChanged = Math.abs(nextWidth - previousWidth) > 6;
  const heightChanged = Math.abs(nextHeight - previousHeight) > 6;

  // V36: ignore small mobile browser address-bar height changes during play.
  // This keeps the old stable V30 layout, but avoids the recent up/down bounce.
  if (gameStarted && !gameOver && !gamePaused && !widthChanged && heightChanged) {
    return;
  }

  setCanvasSize();
  applyPhysicsTuning();

  // Keep bird position valid after iPhone orientation changes.
  bird.x = Math.max(70, Math.min(100, gameWidth * 0.2));
  bird.y = Math.max(bird.size, Math.min(gameHeight - bird.size, bird.y));

  pipes = pipes
    .map(pipe => ({
      ...pipe,
      top: Math.max(40, Math.min(gameHeight - 210, pipe.top)),
      bottom: Math.max(160, Math.min(gameHeight - 40, pipe.bottom))
    }))
    .filter(pipe => pipe.bottom - pipe.top >= 144);
}

window.addEventListener("resize", resizeGameForViewportChange);
