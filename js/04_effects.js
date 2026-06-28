// ── Effects system ──────────────────────────────────────────────────────────
function recalculateEffectMultipliers() {
  sizeMultiplier = activeEffects.size ? activeEffects.size.sizeMultiplier : 1;
  speedMultiplier = activeEffects.speed ? activeEffects.speed.speedMultiplier : 1;
  recalculateBirdSize();
}

function getPipeSpeedMultiplier() {
  return speedMultiplier;
}

function normalizeEffectLabelForDeath(label) {
  if (!label || label === "None") {
    return "None";
  }

  if (label === "God Mode Ready" || label === "God Mode Activated") {
    return "God Mode";
  }

  if (label.startsWith("God Ready") || label.startsWith("God Mode Active")) {
    return "God Mode";
  }

  return label;
}

function rememberRoundEffect(label) {
  lastRoundEffectLabel = label;
}

function addGodModeCharge() {
  godModeCharges += 1;
  rememberRoundEffect("God Mode");
}

function rescueFromDeath(collisionInfo) {
  if (!collisionInfo) {
    bird.y = clamp(bird.y, bird.size, gameHeight - bird.size);
    bird.velocity = 0;
    return;
  }

  if (collisionInfo.type === "pipe" && collisionInfo.pipe) {
    const gapCenter = (collisionInfo.pipe.top + collisionInfo.pipe.bottom) * 0.5;
    bird.y = clamp(gapCenter, bird.size, gameHeight - bird.size);
    bird.velocity = 0;
    return;
  }

  if (collisionInfo.type === "boundary") {
    bird.y = clamp(bird.y, bird.size, gameHeight - bird.size);
    bird.velocity = 0;
  }
}

function activateGodModeShield(durationMs, collisionInfo) {
  if (godModeCharges <= 0) {
    return false;
  }

  godModeCharges -= 1;
  invincibleUntil = Date.now() + durationMs;
  rememberRoundEffect("God Mode");
  rescueFromDeath(collisionInfo);
  return true;
}

function hasGodModeActive() {
  return Date.now() < invincibleUntil;
}

function tryActivateGodModeShield(collisionInfo) {
  if (hasGodModeActive()) {
    rescueFromDeath(collisionInfo);
    return true;
  }
  return activateGodModeShield(GAME_CONFIG.godModeDurationMs, collisionInfo);
}

function applyRegularMysteryEffect(effectType) {
  const now = Date.now();

  const effectMap = {
    tiny: { slot: "size", label: "Tiny", sizeMultiplier: 0.67 },
    large: { slot: "size", label: "Large", sizeMultiplier: 1.5 },
    slow: {
      slot: "speed",
      label: "Slow",
      speedMultiplier: 0.5,
      durationMs: GAME_CONFIG.slowEffectDurationMs
    },
    fast: { slot: "speed", label: "Fast", speedMultiplier: 1.3 }
  };

  const effect = effectMap[effectType];
  if (!effect) return;

  const durationMs = effect.durationMs || GAME_CONFIG.regularEffectDurationMs;

  activeEffects[effect.slot] = {
    ...effect,
    type: effectType,
    expiresAt: now + durationMs
  };
  recalculateEffectMultipliers();
  rememberRoundEffect(effect.label);
}

function applyMysteryEffect() {
  const totalWeight = GAME_CONFIG.mysteryEffectWeights.reduce((sum, item) => sum + item.weight, 0);
  let roll = Math.random() * totalWeight;
  let chosen = GAME_CONFIG.mysteryEffectWeights[GAME_CONFIG.mysteryEffectWeights.length - 1];

  for (const item of GAME_CONFIG.mysteryEffectWeights) {
    roll -= item.weight;
    if (roll <= 0) {
      chosen = item;
      break;
    }
  }

  if (chosen.type === "god") {
    addGodModeCharge();
    return;
  }

  applyRegularMysteryEffect(chosen.type);
}

function maybeExpireEffect() {
  const now = Date.now();
  let changed = false;

  Object.keys(activeEffects).forEach(slot => {
    const effect = activeEffects[slot];
    if (effect && now >= effect.expiresAt) {
      activeEffects[slot] = null;
      changed = true;
    }
  });

  if (changed) {
    recalculateEffectMultipliers();
  }
}

function getCurrentEffectLabels(includeStateText) {
  const labels = [];

  if (hasGodModeActive()) {
    if (includeStateText) {
      const remainingSeconds = Math.max(0, Math.ceil((invincibleUntil - Date.now()) / 1000));
      labels.push("God Mode Active " + remainingSeconds + "s");
    } else {
      labels.push("God Mode");
    }
  }

  if (includeStateText && godModeCharges > 0) {
    labels.push("God Ready x" + godModeCharges);
  }

  [activeEffects.size, activeEffects.speed].forEach(effect => {
    if (effect) labels.push(effect.label);
  });

  return labels;
}

function getEffectLabelForDeath() {
  const activeLabels = getCurrentEffectLabels(false);
  if (activeLabels.length > 0) {
    return activeLabels.map(normalizeEffectLabelForDeath).join(" + ");
  }

  if (lastRoundEffectLabel && lastRoundEffectLabel !== "None") {
    return normalizeEffectLabelForDeath(lastRoundEffectLabel);
  }

  return "None";
}

function getActiveEffectLabel() {
  if (gameOver) {
    return deathEffectLabel || "None";
  }

  const labels = getCurrentEffectLabels(true);
  if (labels.length > 0) {
    return labels.join(" + ");
  }

  return "None";
}

function drawPausedOverlay() {
  ctx.fillStyle = "rgba(0,0,0,0.42)";
  ctx.fillRect(0, 0, gameWidth, gameHeight);
  ctx.fillStyle = "white";
  ctx.textAlign = "center";
  ctx.font = "bold " + Math.round(clamp(42 * uiScale, 32, 52)) + "px Arial";
  ctx.fillText("Paused", gameWidth / 2, gameHeight / 2);
  ctx.font = Math.round(clamp(18 * uiScale, 14, 24)) + "px Arial";
  ctx.fillText("Tap Resume to continue", gameWidth / 2, gameHeight / 2 + Math.round(34 * uiScale));
  ctx.textAlign = "left";
}
