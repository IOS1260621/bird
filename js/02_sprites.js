// ── Sprite system ──────────────────────────────────────────────────────────
function loadSpriteChoices() {
  try {
    const raw = localStorage.getItem(SPRITE_CHOICES_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    return parsed;
  } catch {
    return {};
  }
}

let userAccounts = loadUserAccounts();
let activeUserName = sanitizeUsername(localStorage.getItem(ACTIVE_USER_KEY) || "");
if (activeUserName && !isAllowedPlayerName(activeUserName)) {
  activeUserName = "";
  localStorage.removeItem(ACTIVE_USER_KEY);
}
if (!activeUserName) {
  activeUserName = "Chubdoo";
  localStorage.setItem(ACTIVE_USER_KEY, activeUserName);
}
if (activeUserName) {
  activeUserName = (userAccounts[getUserKey(activeUserName)] || FIXED_USER_ACCOUNTS.chubdoo).userName;
}

let playerName = activeUserName || "Chubdoo";
let scoreHistory = [];
let spriteChoicesByUser = loadSpriteChoices();

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function setCanvasSize() {
  // Match iPhone's dynamic viewport height and render sharply on retina screens.
  gameWidth = window.innerWidth;
  gameHeight = window.innerHeight;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.style.width = gameWidth + "px";
  canvas.style.height = gameHeight + "px";
  canvas.width = Math.floor(gameWidth * dpr);
  canvas.height = Math.floor(gameHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  uiScale = clamp(Math.min(gameWidth / 390, gameHeight / 844), 0.85, 1.2);
}

setCanvasSize();

let bird = {
  x: 0,
  y: gameHeight / 2,
  baseSize: 24,
  size: 24,
  velocity: 0,
  gravity: 0.45,
  jump: -8
};

bird.x = Math.max(70, Math.min(100, gameWidth * 0.2));

function recalculateBirdSize() {
  bird.size = Math.max(0, Math.round(bird.baseSize * sizeMultiplier));
}

function applyPhysicsTuning() {
  bird.baseSize = Math.round(clamp(
    gameWidth * GAME_CONFIG.playerBaseSizeWidthRatio,
    GAME_CONFIG.playerBaseSizeMin,
    GAME_CONFIG.playerBaseSizeMax
  ));
  recalculateBirdSize();
  bird.gravity = clamp(
    GAME_CONFIG.gravityBase + gameHeight / GAME_CONFIG.gravityHeightDivisor,
    GAME_CONFIG.gravityMin,
    GAME_CONFIG.gravityMax
  );
  bird.jump = -clamp(
    GAME_CONFIG.jumpBase + gameHeight / GAME_CONFIG.jumpHeightDivisor,
    GAME_CONFIG.jumpMin,
    GAME_CONFIG.jumpMax
  );
}



applyPhysicsTuning();

function getDifficulty(rawScore) {
  const safeScore = Math.max(0, Math.floor(Number(rawScore) || 0));

  if (safeScore < 10) {
    return {
      name: "Beginner",
      gapSize: 200,
      pipeSpeed: 2.1,
      pipeSpacing: 300,
      minGapMove: 35,
      maxGapMove: 100,
      patternChance: 0.15,
      maxPatternDifficulty: 1
    };
  }

  if (safeScore < 30) {
    return {
      name: "Medium",
      gapSize: 180,
      pipeSpeed: 2.35,
      pipeSpacing: 285,
      minGapMove: 45,
      maxGapMove: 125,
      patternChance: 0.35,
      maxPatternDifficulty: 2
    };
  }

  if (safeScore < 60) {
    return {
      name: "Hard",
      gapSize: 160,
      pipeSpeed: 2.65,
      pipeSpacing: 265,
      minGapMove: 55,
      maxGapMove: 150,
      patternChance: 0.50,
      maxPatternDifficulty: 3
    };
  }

  if (safeScore < 100) {
    return {
      name: "Expert",
      gapSize: 145,
      pipeSpeed: 2.9,
      pipeSpacing: 250,
      minGapMove: 65,
      maxGapMove: 170,
      patternChance: 0.65,
      maxPatternDifficulty: 4
    };
  }

  return {
    name: "Legend",
    gapSize: 135,
    pipeSpeed: 3.1,
    pipeSpacing: 240,
    minGapMove: 75,
    maxGapMove: 190,
    patternChance: 0.75,
    maxPatternDifficulty: 5
  };
}

const GAP_PATTERNS = [
  {
    name: "Gentle Climb",
    minScore: 8,
    difficulty: 1,
    weight: 18,
    recoveryAfter: false,
    moves: [-0.70, -0.80, -0.65]
  },
  {
    name: "Gentle Drop",
    minScore: 8,
    difficulty: 1,
    weight: 18,
    recoveryAfter: false,
    moves: [0.70, 0.80, 0.65]
  },
  {
    name: "Steep Climb",
    minScore: 20,
    difficulty: 2,
    weight: 13,
    recoveryAfter: true,
    moves: [-1.05, -1.10, -0.90]
  },
  {
    name: "Steep Drop",
    minScore: 20,
    difficulty: 2,
    weight: 13,
    recoveryAfter: true,
    moves: [1.05, 1.10, 0.90]
  },
  {
    name: "Tent",
    minScore: 25,
    difficulty: 2,
    weight: 14,
    recoveryAfter: false,
    moves: [-0.95, -0.85, 0.85, 0.95]
  },
  {
    name: "Valley",
    minScore: 25,
    difficulty: 2,
    weight: 14,
    recoveryAfter: false,
    moves: [0.95, 0.85, -0.85, -0.95]
  },
  {
    name: "Climb Then Drop",
    minScore: 35,
    difficulty: 3,
    weight: 11,
    recoveryAfter: true,
    moves: [-1.00, -0.95, 1.15, 0.75]
  },
  {
    name: "Drop Then Climb",
    minScore: 35,
    difficulty: 3,
    weight: 11,
    recoveryAfter: true,
    moves: [1.00, 0.95, -1.15, -0.75]
  },
  {
    name: "U Flat Bottom",
    minScore: 45,
    difficulty: 4,
    weight: 8,
    recoveryAfter: true,
    moves: [0.95, 0.80, 0.08, -0.08, -0.80, -0.95]
  },
  {
    name: "N Flat Top",
    minScore: 60,
    difficulty: 4,
    weight: 8,
    recoveryAfter: true,
    moves: [-0.95, -0.80, -0.08, 0.08, 0.80, 0.95, -0.65]
  },
  {
    name: "Wave",
    minScore: 70,
    difficulty: 5,
    weight: 6,
    recoveryAfter: true,
    moves: [-0.85, 0.85, -0.85, 0.85, -0.65]
  },
  {
    name: "Tight Recovery Tunnel",
    minScore: 90,
    difficulty: 5,
    weight: 5,
    recoveryAfter: false,
    moves: [0.12, -0.12, 0.15, -0.15]
  }
];

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function weightedRandom(items) {
  const totalWeight = items.reduce((sum, item) => sum + Math.max(0, Number(item.weight) || 0), 0);
  if (totalWeight <= 0) {
    return items[Math.floor(Math.random() * items.length)] || null;
  }

  let roll = Math.random() * totalWeight;
  for (const item of items) {
    roll -= Math.max(0, Number(item.weight) || 0);
    if (roll <= 0) {
      return item;
    }
  }
  return items[items.length - 1] || null;
}

function chooseGapPattern(scoreValue, difficulty) {
  if (Math.random() > difficulty.patternChance) {
    return null;
  }

  const eligiblePatterns = GAP_PATTERNS.filter(pattern =>
    scoreValue >= pattern.minScore && pattern.difficulty <= difficulty.maxPatternDifficulty
  );

  return weightedRandom(eligiblePatterns);
}

function resetGapPatternState() {
  activeGapPattern = null;
  activeGapPatternStepIndex = 0;
  forceRecoveryPipe = false;
  currentGapPatternName = "Random Drift";
  currentGapPatternDifficulty = 0;
  lastGapPatternName = "None";
  lastGapPatternDifficulty = 0;
}

function beginGapPattern(pattern) {
  activeGapPattern = pattern || null;
  activeGapPatternStepIndex = 0;
}

function finishGapPatternIfDone() {
  if (!activeGapPattern || activeGapPatternStepIndex < activeGapPattern.moves.length) {
    return;
  }

  lastGapPatternName = activeGapPattern.name;
  lastGapPatternDifficulty = activeGapPattern.difficulty;
  if (activeGapPattern.recoveryAfter) {
    forceRecoveryPipe = true;
  }
  activeGapPattern = null;
  activeGapPatternStepIndex = 0;
}

function createRandomDriftMove(difficulty) {
  const variationBoost = Math.random() < 0.22 ? 1.28 : 1.0;
  const minMove = difficulty.minGapMove;
  const maxMove = difficulty.maxGapMove * variationBoost;
  const moveAmount = randomBetween(minMove, maxMove);
  const direction = Math.random() < 0.5 ? -1 : 1;
  currentGapPatternName = "Random Drift";
  currentGapPatternDifficulty = 0;
  return direction * moveAmount;
}

function createPatternMove(difficulty) {
  if (!activeGapPattern) {
    return createRandomDriftMove(difficulty);
  }

  const pattern = activeGapPattern;
  const step = pattern.moves[activeGapPatternStepIndex] || 0;
  activeGapPatternStepIndex += 1;

  currentGapPatternName = pattern.name;
  currentGapPatternDifficulty = pattern.difficulty;

  const variationBoost = Math.random() < 0.18 ? 1.18 : 1.0;
  const baseMove = randomBetween(difficulty.minGapMove, difficulty.maxGapMove) * variationBoost;
  const flatJitter = randomBetween(-difficulty.minGapMove * 0.20, difficulty.minGapMove * 0.20);
  const move = Math.abs(step) < 0.20 ? flatJitter : step * baseMove;

  finishGapPatternIfDone();
  return move;
}

function createRecoveryMove(previousGapY, canvasHeight, difficulty) {
  const targetY = canvasHeight * 0.50;
  const deltaToCenter = targetY - previousGapY;
  const direction = deltaToCenter >= 0 ? 1 : -1;
  const absDelta = Math.abs(deltaToCenter);

  forceRecoveryPipe = false;
  currentGapPatternName = "Recovery";
  currentGapPatternDifficulty = 0;

  if (absDelta < difficulty.minGapMove * 0.65) {
    return createRandomDriftMove(difficulty) * 0.45;
  }

  const recoveryMove = clamp(absDelta, difficulty.minGapMove * 0.75, difficulty.maxGapMove * 0.72);
  return direction * recoveryMove;
}

function applyGapMoveWithEdgeProtection(previousGapY, change, minGapY, maxGapY, difficulty) {
  let nextGapY = previousGapY + change;

  if (nextGapY < minGapY || nextGapY > maxGapY) {
    // If the chosen pattern/random move would hit the screen edge, bounce partway
    // in the opposite direction instead of creating an unfair edge-clamped gap.
    nextGapY = previousGapY - change * 0.62;
  }

  nextGapY = clamp(nextGapY, minGapY, maxGapY);

  // If the move became too small after clamping, push it toward the center.
  const visibleMove = Math.abs(nextGapY - previousGapY);
  if (visibleMove < difficulty.minGapMove * 0.45) {
    const centerY = (minGapY + maxGapY) / 2;
    const directionToCenter = centerY >= previousGapY ? 1 : -1;
    nextGapY = clamp(previousGapY + directionToCenter * difficulty.minGapMove, minGapY, maxGapY);
  }

  return nextGapY;
}

function createNextGap(previousGapY, scoreValue, canvasHeight) {
  const d = getDifficulty(scoreValue);
  const safetyMargin = Math.round(clamp(30 * uiScale, 24, 42));
  const minGapY = d.gapSize / 2 + safetyMargin;
  const maxGapY = canvasHeight - d.gapSize / 2 - safetyMargin;

  if (!Number.isFinite(previousGapY)) {
    resetGapPatternState();
    const centerBandMin = Math.max(minGapY, canvasHeight * 0.36);
    const centerBandMax = Math.min(maxGapY, canvasHeight * 0.64);
    currentGapPatternName = "Round Start";
    currentGapPatternDifficulty = 0;
    return randomBetween(centerBandMin, centerBandMax);
  }

  if (!activeGapPattern && !forceRecoveryPipe) {
    beginGapPattern(chooseGapPattern(scoreValue, d));
  }

  let change;
  if (forceRecoveryPipe) {
    change = createRecoveryMove(previousGapY, canvasHeight, d);
  } else if (activeGapPattern) {
    change = createPatternMove(d);
  } else {
    change = createRandomDriftMove(d);
  }

  return applyGapMoveWithEdgeProtection(previousGapY, change, minGapY, maxGapY, d);
}

function getDeviceType() {
  const ua = navigator.userAgent || "";
  if (/iPhone|iPod/i.test(ua)) return "iPhone";
  if (/iPad/i.test(ua)) return "iPad";
  if (/Android/i.test(ua)) return "Android";
  if (gameWidth <= 760) return "Mobile";
  return "Desktop";
}

function getNextAttemptNumber() {
  const current = Math.max(0, Math.floor(Number(localStorage.getItem(GAME_ATTEMPT_COUNT_KEY)) || 0));
  const next = current + 1;
  localStorage.setItem(GAME_ATTEMPT_COUNT_KEY, String(next));
  return next;
}

function isMissingMetadataColumnError(error) {
  const message = String(error && error.message ? error.message : error || "").toLowerCase();
  return message.includes("column") || message.includes("schema cache") || message.includes("could not find");
}


function getCollisionRadius() {
  return bird.size * GAME_CONFIG.collisionRadiusMultiplier;
}

function formatPlayedAt(isoTime) {
  const date = new Date(isoTime);
  if (Number.isNaN(date.getTime())) {
    return "Unknown time";
  }
  return date.toLocaleString();
}

function formatPlayedAtShort(isoTime) {
  const date = new Date(isoTime);
  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  const datePart = date.toLocaleDateString();
  const timePart = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return datePart + " " + timePart;
}

function normalizedName(name) {
  return sanitizeName(name).toLowerCase();
}

function getPlayedAtTime(entry) {
  const timeValue = new Date(entry.playedAt).getTime();
  return Number.isFinite(timeValue) ? timeValue : Number.MAX_SAFE_INTEGER;
}

function compareScoreEntries(a, b) {
  if (b.score !== a.score) {
    return b.score - a.score;
  }
  // Earlier timestamp wins tie-breaker for top scorer ranking.
  return getPlayedAtTime(a) - getPlayedAtTime(b);
}

function isValidScoreEntry(entry) {
  return entry &&
    typeof entry.name === "string" &&
    isAllowedPlayerName(entry.name) &&
    Number.isFinite(entry.score) &&
    typeof entry.playedAt === "string";
}

function getScoreEntryKey(entry) {
  return normalizedName(entry.name) + "|" + entry.score + "|" + entry.playedAt;
}

function mergeScoreEntries(...entryLists) {
  const seen = new Set();
  const merged = [];

  entryLists.flat().filter(isValidScoreEntry).forEach(entry => {
    const key = getScoreEntryKey(entry);
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(entry);
    }
  });

  return merged.sort(compareScoreEntries);
}

function loadPerUserTop3Forever() {
  try {
    const raw = localStorage.getItem(PER_USER_TOP3_FOREVER_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    const today = getDayString();
    const cleaned = {};
    Object.keys(parsed).forEach(userKey => {
      const entries = Array.isArray(parsed[userKey]) ? parsed[userKey] : [];
      const todaysEntries = entries.filter(entry => isScoreEntryFromDay(entry, today));
      const ranked = mergeScoreEntries(todaysEntries).slice(0, 3);
      if (ranked.length > 0) {
        cleaned[userKey] = ranked;
      }
    });
    return cleaned;
  } catch {
    return {};
  }
}

function savePerUserTop3Forever(top3ByUser) {
  localStorage.setItem(PER_USER_TOP3_FOREVER_KEY, JSON.stringify(top3ByUser));
}

function updatePerUserTop3Forever() {
  const top3ByUser = loadPerUserTop3Forever();

  scoreHistory.filter(isValidScoreEntry).forEach(entry => {
    const userKey = normalizedName(entry.name);
    top3ByUser[userKey] = mergeScoreEntries(top3ByUser[userKey] || [], [entry]).slice(0, 3);
  });

  savePerUserTop3Forever(top3ByUser);
}

function getPermanentTopScoresForPlayer(name) {
  const top3ByUser = loadPerUserTop3Forever();
  return top3ByUser[normalizedName(name)] || [];
}

function getScoresForPlayer(name) {
  const nameKey = normalizedName(name);
  const currentScores = scoreHistory.filter(entry => normalizedName(entry.name) === nameKey);
  const permanentScores = getPermanentTopScoresForPlayer(name);
  return mergeScoreEntries(currentScores, permanentScores);
}

function getTopScores(limit) {
  if (cloudScoresLoaded && cloudTopScores.length > 0) {
    return cloudTopScores
      .slice()
      .sort(compareScoreEntries)
      .slice(0, limit);
  }

  return scoreHistory
    .slice()
    .sort(compareScoreEntries)
    .slice(0, limit);
}

function saveSpriteChoices() {
  localStorage.setItem(SPRITE_CHOICES_KEY, JSON.stringify(spriteChoicesByUser));
}

function isCurrentPlayerTopScorer() {
  const currentKey = getUserKey(playerName);

  // V31: once cloud scores load, the daily cloud points leader gets the starter bonus.
  if (cloudScoresLoaded) {
    return Boolean(cloudDailyLeaderKey) && currentKey === cloudDailyLeaderKey;
  }

  const topEntry = getTopScores(1)[0];
  return Boolean(topEntry) && normalizedName(topEntry.name) === normalizedName(playerName);
}

function getAllowedSpritesForCurrentUser() {
  return isCurrentPlayerTopScorer() ? AVAILABLE_DOG_SPRITES : PNG_DOG_SPRITES;
}

function getDefaultSpriteForCurrentUser() {
  if (isCurrentPlayerTopScorer()) {
    return DEFAULT_DOG_SPRITE;
  }
  return PNG_DOG_SPRITES[0] || DEFAULT_DOG_SPRITE;
}

function refreshSpritePickerOptions() {
  if (!spritePicker) {
    return;
  }

  const allowedSprites = getAllowedSpritesForCurrentUser();
  spritePicker.innerHTML = "";

  allowedSprites.forEach(spriteName => {
    const option = document.createElement("option");
    option.value = spriteName;
    option.textContent = spriteName;
    spritePicker.appendChild(option);
  });
}

function getCurrentPlayerSpriteChoice() {
  const storedChoice = spriteChoicesByUser[normalizedName(playerName)];
  const allowedSprites = getAllowedSpritesForCurrentUser();
  if (allowedSprites.includes(storedChoice)) {
    return storedChoice;
  }
  return getDefaultSpriteForCurrentUser();
}

function applySpriteChoice(chosenSprite) {
  if (!activeUserName) {
    return;
  }

  const allowedSprites = getAllowedSpritesForCurrentUser();
  const fallback = getDefaultSpriteForCurrentUser();
  const chosen = allowedSprites.includes(chosenSprite) ? chosenSprite : fallback;

  spriteChoicesByUser[normalizedName(playerName)] = chosen;
  saveSpriteChoices();
  currentSprite = chosen;
  if (spritePicker) {
    spritePicker.value = chosen;
  }
  updateSelectedSpritePreview(chosen);
}

function chooseRandomSprite() {
  const allowedSprites = getAllowedSpritesForCurrentUser();
  if (!allowedSprites.length) {
    return;
  }
  const randomIndex = Math.floor(Math.random() * allowedSprites.length);
  applySpriteChoice(allowedSprites[randomIndex]);
}

function resetSpriteChoiceToDefault() {
  applySpriteChoice(getDefaultSpriteForCurrentUser());
}

function updateSelectedSpritePreview(spriteName) {
  if (!selectedSpritePreview || !selectedSpritePreviewImage) {
    return;
  }

  if (!activeUserName || !spriteName) {
    selectedSpritePreview.style.display = "none";
    selectedSpritePreviewImage.removeAttribute("src");
    if (selectedSpriteLabel) {
      selectedSpriteLabel.textContent = "";
    }
    return;
  }

  selectedSpritePreview.style.display = "flex";
  selectedSpritePreviewImage.src = spriteName;
  selectedSpritePreviewImage.alt = "Selected Bruce sprite: " + spriteName;
  if (selectedSpriteLabel) {
    selectedSpriteLabel.textContent = "Selected: " + spriteName;
  }
}

function updateStartButtonState() {
  if (!startGameButton) {
    return;
  }

  const canStart = canStartCurrentRound();
  startGameButton.disabled = !canStart;

  if (!startStatusMessage) {
    return;
  }

  if (!activeUserName) {
    startStatusMessage.textContent = "Choose a player to continue.";
  } else if (isNoBackgroundPhotoEnabled() && !revealImageReady) {
    startStatusMessage.textContent = "Ready to play with no background photo.";
  } else if (isNoBackgroundPhotoEnabled() && revealImageReady) {
    startStatusMessage.textContent = "No background photo mode is on.";
  } else if (!revealImageReady) {
    startStatusMessage.textContent = "Pick a photo or check No background photo.";
  } else {
    startStatusMessage.textContent = "Ready to play.";
  }
  draw();
}

function applyCurrentPlayerSprite() {
  if (!activeUserName) {
    currentSprite = DEFAULT_DOG_SPRITE;
    if (spritePickerRow) {
      spritePickerRow.style.display = "none";
    }
    spriteHint.style.display = "none";
    updateSelectedSpritePreview("");
    return;
  }

  refreshSpritePickerOptions();
  const chosen = getCurrentPlayerSpriteChoice();
  currentSprite = chosen;
  if (spritePicker) {
    spritePicker.value = chosen;
  }
  updateSelectedSpritePreview(chosen);
  if (spritePickerRow) {
    spritePickerRow.style.display = "none";
  }
  spriteHint.style.display = "block";

  if (isCurrentPlayerTopScorer()) {
    spriteHint.textContent = "Top scorer can use dog.svg or any PNG avatar.";
  } else {
    spriteHint.textContent = "Choose any PNG avatar. dog.svg unlocks for top scorer.";
  }
}
