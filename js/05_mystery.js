// ── Mystery box system ──────────────────────────────────────────────────────
function spawnMysteryBoxAt(x, y) {
  mysteryBox = {
    x,
    y,
    size: Math.round(clamp(34 * uiScale, 28, 42)),
    active: true
  };
}

function findBestMysterySpawnPoint() {
  const futurePipes = pipes
    .filter(pipe => pipe.x + pipe.width > bird.x + Math.round(80 * uiScale))
    .sort((a, b) => a.x - b.x);

  for (let i = 0; i < futurePipes.length - 1; i += 1) {
    const leftPipe = futurePipes[i];
    const rightPipe = futurePipes[i + 1];
    const centerX = (leftPipe.x + leftPipe.width + rightPipe.x) * 0.5;
    if (centerX > bird.x + Math.round(120 * uiScale) && centerX < gameWidth + Math.round(120 * uiScale)) {
      const leftGapCenterY = (leftPipe.top + leftPipe.bottom) * 0.5;
      const rightGapCenterY = (rightPipe.top + rightPipe.bottom) * 0.5;
      return {
        x: centerX,
        y: clamp((leftGapCenterY + rightGapCenterY) * 0.5, 60, gameHeight - 60)
      };
    }
  }

  const referencePipe = futurePipes[0] || pipes[pipes.length - 1];
  const fallbackY = referencePipe ? (referencePipe.top + referencePipe.bottom) * 0.5 : gameHeight * 0.5;
  return {
    x: gameWidth * 0.78,
    y: clamp(fallbackY, 60, gameHeight - 60)
  };
}

function maybeSpawnMysteryBoxForScore() {
  if (mysteryBox && mysteryBox.active) {
    return;
  }

  if (score < nextMysteryScoreThreshold) {
    return;
  }

  const point = findBestMysterySpawnPoint();
  spawnMysteryBoxAt(point.x, point.y);

  if (!firstMysteryQueued) {
    firstMysteryQueued = true;
    nextMysteryScoreThreshold = GAME_CONFIG.repeatMysteryStartScore;
  } else {
    nextMysteryScoreThreshold += GAME_CONFIG.repeatMysteryInterval;
  }
}

function maybeCollectMysteryBox() {
  if (!mysteryBox || !mysteryBox.active) {
    return;
  }

  const half = mysteryBox.size / 2;
  const withinX = bird.x + bird.size > mysteryBox.x - half && bird.x - bird.size < mysteryBox.x + half;
  const withinY = bird.y + bird.size > mysteryBox.y - half && bird.y - bird.size < mysteryBox.y + half;
  if (withinX && withinY) {
    mysteryBox.active = false;
    playMysteryCoinSound();
    applyMysteryEffect();
  }
}

function getBottomColumnLabel() {
  if (cloudScoresLoaded && cloudDailyLeaderKey) {
    return cloudDailyLeaderKey === "chubson" ? "SON" : "DOO";
  }

  const topEntry = getTopScores(1)[0];
  if (!topEntry || typeof topEntry.name !== "string") {
    return "DOO";
  }

  const winner = normalizedName(topEntry.name);
  if (winner === "chubson") {
    return "SON";
  }
  if (winner === "chubdoo") {
    return "DOO";
  }
  return "DOO";
}
