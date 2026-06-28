// ── Update loop ────────────────────────────────────────────────────────────
function createPipe() {
  const difficulty = getDifficulty(score);
  const gap = Math.max(70, difficulty.gapSize);
  const gapCenterY = createNextGap(lastPipeGapY, score, gameHeight);
  const topHeight = gapCenterY - gap / 2;

  lastPipeGapY = gapCenterY;
  totalPipesCreated += 1;
  pipes.push({
    id: totalPipesCreated,
    x: gameWidth,
    width: getEffectivePipeWidth(),
    top: topHeight,
    bottom: topHeight + gap,
    passed: false,
    difficultyPhase: difficulty.name,
    pipeSettingsVersion: PIPE_SETTINGS_VERSION,
    gapPattern: currentGapPatternName,
    gapPatternDifficulty: currentGapPatternDifficulty
  });
  lastGapPatternName = currentGapPatternName;
  lastGapPatternDifficulty = currentGapPatternDifficulty;
}



function update() {
  if (!gameStarted || gameOver || gamePaused) return;

  maybeExpireEffect();

  const difficulty = getDifficulty(score);
  const pipeSpeed = difficulty.pipeSpeed * getPipeSpeedMultiplier() * getEffectiveGameSpeedMultiplier();
  const spawnSpacing = getTargetPipeSpacing(difficulty);

  bird.velocity += bird.gravity;
  bird.y += bird.velocity;

  if (pipes.length === 0 || pipes[pipes.length - 1].x < gameWidth - spawnSpacing) {
    createPipe();
  }

  const collisionRadius = getCollisionRadius();

  pipes.forEach(pipe => {
    pipe.x -= pipeSpeed;

    if (!pipe.passed && pipe.x + pipe.width < bird.x) {
      score++;
      pipe.passed = true;
      promptForNewPhotoAtHundred(pipe);
    }

    const pipeCollision =
      bird.x + collisionRadius > pipe.x &&
      bird.x - collisionRadius < pipe.x + pipe.width &&
      (bird.y - collisionRadius < pipe.top || bird.y + collisionRadius > pipe.bottom);

    if (pipeCollision) {
      if (isDeveloperGodModeEnabledForRound()) {
        rescueFromDeath({ type: "pipe", pipe });
      } else if (!hasGodModeActive()) {
        if (!tryActivateGodModeShield({ type: "pipe", pipe })) {
          setGameOver();
        }
      }
    }
  });

  if (backgroundSwapPending) {
    return;
  }

  pipes = pipes.filter(pipe => pipe.x + pipe.width > 0);

  maybeSpawnMysteryBoxForScore();

  if (mysteryBox && mysteryBox.active) {
    mysteryBox.x -= pipeSpeed;
    if (mysteryBox.x + mysteryBox.size < 0) {
      mysteryBox.active = false;
    } else {
      maybeCollectMysteryBox();
    }
  }

  const boundaryCollision = bird.y + collisionRadius > gameHeight || bird.y - collisionRadius < 0;
  if (boundaryCollision) {
    if (isDeveloperGodModeEnabledForRound()) {
      rescueFromDeath({ type: "boundary" });
    } else if (hasGodModeActive()) {
      rescueFromDeath({ type: "boundary" });
    } else if (!tryActivateGodModeShield({ type: "boundary" })) {
      setGameOver();
    }
  }
}



function drawColumnLabel(text, x, y, width, height) {
  if (height < 36) {
    return;
  }

  const fontFamily = "Impact, Arial Black, sans-serif";
  const maxTextWidth = width * 0.88;
  const maxTextHeight = height * 0.35;
  let fontSize = Math.floor(clamp(Math.min(width * 0.62, maxTextHeight), 16, 56));

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#0f172a";

  // Shrink until the label fits the column width.
  while (fontSize > 12) {
    ctx.font = "900 " + fontSize + "px " + fontFamily;
    if (ctx.measureText(text).width <= maxTextWidth) {
      break;
    }
    fontSize -= 1;
  }

  ctx.fillText(text, x + width / 2, y + height / 2);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
}

function seededNoise(value) {
  const s = Math.sin(value) * 10000;
  return s - Math.floor(s);
}

function drawElectricity(pipe, timeMs) {
  const startY = pipe.top + 2;
  const endY = pipe.bottom - 2;
  const gapHeight = endY - startY;
  if (gapHeight < 28) {
    return;
  }

  const arcCount = 3;
  const segmentCount = 7;

  for (let i = 0; i < arcCount; i += 1) {
    const anchorX = pipe.x + pipe.width * (0.2 + i * 0.3);
    const phase = timeMs * 0.013 + pipe.x * 0.04 + i * 11;
    const jitter = pipe.width * 0.22;
    const flicker = 0.55 + 0.45 * Math.sin(phase * 1.9);

    ctx.beginPath();
    ctx.moveTo(anchorX, startY);

    for (let step = 1; step < segmentCount; step += 1) {
      const t = step / segmentCount;
      const y = startY + gapHeight * t;
      const xJitter = (seededNoise(phase + step * 2.17) - 0.5) * jitter;
      ctx.lineTo(anchorX + xJitter, y);
    }

    ctx.lineTo(anchorX, endY);

    ctx.save();
    ctx.strokeStyle = "rgba(57, 255, 20, " + (0.35 + flicker * 0.35) + ")";
    ctx.lineWidth = 6;
    ctx.shadowColor = "rgba(57, 255, 20, 0.95)";
    ctx.shadowBlur = 14;
    ctx.stroke();

    ctx.strokeStyle = "rgba(200, 255, 120, " + (0.72 + flicker * 0.28) + ")";
    ctx.lineWidth = 2;
    ctx.shadowBlur = 0;
    ctx.stroke();
    ctx.restore();
  }
}

function getFibonacciLevel() {
  return Math.floor(score / 10);
}

function drawFibonacciPattern(pipe, y, height, timeMs, sectionOffset) {
  const level = getFibonacciLevel();
  if (level < 1 || height < 70) {
    return;
  }

  // Every 10 points, red Fibonacci marks appear in a more randomized pattern.
  // The randomness is deterministic per column/score level, so it does not flicker frame-to-frame.
  const patternSeed = pipe.id * 97 + level * 53 + sectionOffset * 0.37;
  if (seededNoise(patternSeed) < 0.22) {
    return;
  }

  const baseFib = [1, 1, 2, 3, 5, 8, 13, 21];
  const fib = baseFib.slice();
  for (let i = fib.length - 1; i > 0; i -= 1) {
    const j = Math.floor(seededNoise(patternSeed + i * 19.73) * (i + 1));
    const temp = fib[i];
    fib[i] = fib[j];
    fib[j] = temp;
  }

  const cx = pipe.x + pipe.width / 2;
  const availableHeight = Math.max(40, height - 24);
  const topY = y + 12;
  const pulse = 0.5 + 0.5 * Math.sin(timeMs * 0.004 + patternSeed);
  const points = [];

  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  fib.forEach((value, index) => {
    const slot = (index + seededNoise(patternSeed + value * 7.91) * 0.72) / fib.length;
    const t = clamp(slot, 0.04, 0.96);
    const dotY = topY + availableHeight * t;
    const jitterSeed = patternSeed + index * 41.11 + value * 5.17;
    const waveX = (seededNoise(jitterSeed) - 0.5) * pipe.width * 0.72;
    const radiusNoise = 0.72 + seededNoise(jitterSeed + 13.13) * 0.72;
    const radius = clamp(value * 0.48 * radiusNoise * uiScale, 2.5, 12);
    const x = clamp(cx + waveX, pipe.x + radius + 3, pipe.x + pipe.width - radius - 3);
    const opacity = 0.28 + pulse * 0.18 + seededNoise(jitterSeed + 29.29) * 0.18;

    points.push({ x, y: dotY, value });

    ctx.beginPath();
    ctx.fillStyle = "rgba(220, 38, 38, " + clamp(opacity, 0.22, 0.72) + ")";
    ctx.shadowColor = "rgba(220, 38, 38, 0.45)";
    ctx.shadowBlur = 8;
    ctx.arc(x, dotY, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    if (seededNoise(jitterSeed + 71.71) > 0.18) {
      ctx.font = "800 " + Math.round(clamp(9 * uiScale, 8, 12)) + "px Arial";
      ctx.fillStyle = "rgba(255, 235, 235, 0.9)";
      ctx.fillText(String(value), x, dotY);
    }
  });

  ctx.strokeStyle = "rgba(220, 38, 38, 0.46)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  points.forEach((point, index) => {
    if (index === 0 || seededNoise(patternSeed + index * 23.23) < 0.16) {
      ctx.moveTo(point.x, point.y);
    } else {
      ctx.lineTo(point.x, point.y);
    }
  });
  ctx.stroke();
  ctx.restore();
}


function drawTotalPointsPieChart(panelX, panelY, panelWidth, panelHeight) {
  const data = getTotalPointsChartData();
  const totalPoints = data.reduce((sum, item) => sum + item.totalPoints, 0);
  const titleFont = Math.round(clamp(15 * uiScale, 12, 19));
  const labelFont = Math.round(clamp(12 * uiScale, 10, 15));
  const valueFont = Math.round(clamp(13 * uiScale, 11, 16));

  ctx.save();
  ctx.fillStyle = "rgba(15,23,42,0.76)";
  ctx.fillRect(panelX, panelY, panelWidth, panelHeight);
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = 1;
  ctx.strokeRect(panelX, panelY, panelWidth, panelHeight);

  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#f8fafc";
  ctx.font = "900 " + titleFont + "px Arial";
  ctx.fillText(cloudScoresLoaded ? "Cloud Daily Points Battle" : "Total Points Battle", panelX + panelWidth / 2, panelY + Math.round(clamp(22 * uiScale, 18, 28)));

  const radius = Math.round(clamp(Math.min(panelWidth * 0.18, panelHeight * 0.32), 38, 62));
  const centerX = panelX + Math.round(panelWidth * 0.29);
  const centerY = panelY + Math.round(panelHeight * 0.57);
  const colors = {
    chubson: "#38bdf8",
    chubdoo: "#fbbf24"
  };

  if (totalPoints <= 0) {
    ctx.beginPath();
    ctx.fillStyle = "#64748b";
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f8fafc";
    ctx.font = "700 " + labelFont + "px Arial";
    ctx.fillText("No points yet", centerX, centerY + 4);
  } else {
    let startAngle = -Math.PI / 2;
    data.forEach(item => {
      if (item.totalPoints <= 0) {
        return;
      }
      const sliceAngle = (item.totalPoints / totalPoints) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.fillStyle = colors[item.userKey] || "#e2e8f0";
      ctx.arc(centerX, centerY, radius, startAngle, startAngle + sliceAngle);
      ctx.closePath();
      ctx.fill();
      startAngle += sliceAngle;
    });

    ctx.beginPath();
    ctx.strokeStyle = "rgba(255,255,255,0.78)";
    ctx.lineWidth = 2;
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = "rgba(15,23,42,0.82)";
    ctx.beginPath();
    ctx.arc(centerX, centerY, Math.max(18, radius * 0.38), 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#f8fafc";
    ctx.font = "900 " + valueFont + "px Arial";
    ctx.fillText(String(totalPoints), centerX, centerY - 1);
    ctx.font = "700 " + Math.round(clamp(10 * uiScale, 8, 12)) + "px Arial";
    ctx.fillText("pts", centerX, centerY + Math.round(clamp(13 * uiScale, 10, 15)));
  }

  const legendX = panelX + Math.round(panelWidth * 0.55);
  const firstLegendY = panelY + Math.round(panelHeight * 0.47);
  ctx.textAlign = "left";
  data.forEach((item, index) => {
    const y = firstLegendY + index * Math.round(clamp(34 * uiScale, 28, 40));
    const pct = totalPoints > 0 ? Math.round((item.totalPoints / totalPoints) * 100) : 0;

    ctx.fillStyle = colors[item.userKey] || "#e2e8f0";
    ctx.fillRect(legendX, y - 11, 13, 13);

    ctx.fillStyle = "#f8fafc";
    ctx.font = "900 " + labelFont + "px Arial";
    ctx.fillText(item.userName, legendX + 22, y);

    ctx.fillStyle = "#cbd5e1";
    ctx.font = "700 " + labelFont + "px Arial";
    ctx.fillText(item.totalPoints + " today  •  " + pct + "%", legendX + 22, y + Math.round(clamp(16 * uiScale, 13, 19)));

    if (cloudScoresLoaded) {
      ctx.fillStyle = "#94a3b8";
      ctx.font = "700 " + Math.round(clamp(10 * uiScale, 8, 12)) + "px Arial";
      ctx.fillText("Life: " + (item.lifetimePoints || 0) + " pts", legendX + 22, y + Math.round(clamp(30 * uiScale, 24, 34)));
    }
  });

  const statusText = getCloudStatusText();
  ctx.textAlign = "center";
  ctx.fillStyle = cloudLastErrorDetail ? "#fecaca" : "#bbf7d0";
  ctx.font = "800 " + Math.round(clamp(10 * uiScale, 8, 12)) + "px Arial";
  ctx.fillText(statusText.slice(0, 70), panelX + panelWidth / 2, panelY + panelHeight - Math.round(clamp(7 * uiScale, 5, 9)));

  ctx.restore();
}

function drawCloudScoreMiniHud(hudX, startY) {
  const fontSize = Math.round(clamp(13 * uiScale, 11, 17));
  const leaderName = cloudDailyLeaderKey ? FIXED_USER_ACCOUNTS[cloudDailyLeaderKey].userName : "Tie";
  const dooPoints = cloudScoresLoaded ? (cloudDailyTotals.chubdoo.totalPoints || 0) : (loadTotalPointsByUser().chubdoo.totalPoints || 0);
  const sonPoints = cloudScoresLoaded ? (cloudDailyTotals.chubson.totalPoints || 0) : (loadTotalPointsByUser().chubson.totalPoints || 0);
  const label = (cloudScoresLoaded ? "Cloud Daily" : "Daily") + ": Doo " + dooPoints + " • Son " + sonPoints;

  ctx.font = "800 " + fontSize + "px Arial";
  ctx.fillStyle = "#111827";
  ctx.fillText(label, hudX, startY);

  ctx.font = "800 " + fontSize + "px Arial";
  ctx.fillStyle = cloudScoresLoaded ? "#16a34a" : "#64748b";
  ctx.fillText((cloudScoresLoaded ? "Leader: " : "Local leader: ") + leaderName, hudX, startY + Math.round(clamp(17 * uiScale, 14, 21)));
}

function draw() {
  ctx.clearRect(0, 0, gameWidth, gameHeight);
  drawGameBackground();
  const nowMs = performance.now();
  const bottomColumnLabel = getBottomColumnLabel();

  // Pipes
  pipes.forEach(pipe => {
    const gantryHeight = Math.round(clamp(74 * uiScale, 64, 96));

    // Column bodies styled as CT machine structures.
    ctx.fillStyle = "#cbd5e1";
    ctx.fillRect(pipe.x, 0, pipe.width, pipe.top);
    ctx.fillRect(pipe.x, pipe.bottom, pipe.width, gameHeight - pipe.bottom);

    ctx.fillStyle = "#94a3b8";
    ctx.fillRect(pipe.x, pipe.top - 8, pipe.width, 8);
    ctx.fillRect(pipe.x, pipe.bottom, pipe.width, 8);

    drawColumnLabel("CHUB", pipe.x, 0, pipe.width, pipe.top);
    drawColumnLabel(bottomColumnLabel, pipe.x, pipe.bottom, pipe.width, gameHeight - pipe.bottom);
    drawFibonacciPattern(pipe, 0, pipe.top, nowMs, 0);
    drawFibonacciPattern(pipe, pipe.bottom, gameHeight - pipe.bottom, nowMs, 1000);

    // Gantry openings at the edge of the playable gap.
    const topGantryY = pipe.top - gantryHeight;
    const bottomGantryY = pipe.bottom;

    if (ctGantryImage.complete && ctGantryImage.naturalWidth > 0) {
      ctx.drawImage(ctGantryImage, pipe.x, topGantryY, pipe.width, gantryHeight);
      ctx.drawImage(ctGantryImage, pipe.x, bottomGantryY, pipe.width, gantryHeight);
    } else {
      ctx.fillStyle = "#64748b";
      ctx.fillRect(pipe.x, topGantryY, pipe.width, gantryHeight);
      ctx.fillRect(pipe.x, bottomGantryY, pipe.width, gantryHeight);

      ctx.fillStyle = "#e2e8f0";
      ctx.fillRect(pipe.x + pipe.width * 0.2, topGantryY + gantryHeight * 0.3, pipe.width * 0.6, gantryHeight * 0.4);
      ctx.fillRect(pipe.x + pipe.width * 0.2, bottomGantryY + gantryHeight * 0.3, pipe.width * 0.6, gantryHeight * 0.4);
    }

    drawElectricity(pipe, nowMs);
  });

  if (mysteryBox && mysteryBox.active) {
    const size = mysteryBox.size;
    const half = size / 2;
    const x = mysteryBox.x - half;
    const y = mysteryBox.y - half;

    ctx.fillStyle = "#f59e0b";
    ctx.fillRect(x, y, size, size);
    ctx.strokeStyle = "#7c2d12";
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, size, size);

    ctx.fillStyle = "#111827";
    ctx.font = "900 " + Math.round(size * 0.7) + "px Impact, Arial Black, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("?", mysteryBox.x, mysteryBox.y + 1);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }

  // Player character (dog image when available, fallback to circle while loading).
  const spriteSize = bird.size * 2;
  const spriteX = bird.x - bird.size;
  const spriteY = bird.y - bird.size;

  const activeSpriteImage = spriteImages[currentSprite] || spriteImages[DEFAULT_DOG_SPRITE];

  if (activeSpriteImage && activeSpriteImage.complete && activeSpriteImage.naturalWidth > 0) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(bird.x, bird.y, bird.size, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(activeSpriteImage, spriteX, spriteY, spriteSize, spriteSize);
    ctx.restore();
  } else {
    ctx.fillStyle = "#facc15";
    ctx.beginPath();
    ctx.arc(bird.x, bird.y, bird.size, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.arc(bird.x + 8, bird.y - 7, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  // Score
  const scoreFont = Math.round(clamp(34 * uiScale, 28, 42));
  const hudX = Math.round(clamp(22 * uiScale, 18, 32));
  const hudY = Math.round(clamp(56 * uiScale, 46, 70));

  ctx.fillStyle = "#111827";
  const playerLabel = (playerName || "Player") + ":";
  const nameFont = Math.round(clamp(20 * uiScale, 16, 26));
  ctx.font = "bold " + nameFont + "px Arial";
  ctx.fillText(playerLabel, hudX, hudY);

  const scoreX = hudX + ctx.measureText(playerLabel).width + Math.round(10 * uiScale);
  ctx.font = "bold " + scoreFont + "px Arial";
  ctx.fillText(score, scoreX, hudY);

  const effectFont = Math.round(clamp(16 * uiScale, 13, 20));
  const effectY = hudY + Math.round(clamp(24 * uiScale, 20, 30));
  ctx.font = "700 " + effectFont + "px Arial";
  ctx.fillStyle = "#111827";
  const effectLabel = "Effect: ";
  ctx.fillText(effectLabel, hudX, effectY);

  ctx.font = "900 " + effectFont + "px Arial";
  ctx.fillStyle = "#dc2626";
  ctx.fillText(getActiveEffectLabel(), hudX + ctx.measureText(effectLabel).width, effectY);

  drawCloudScoreMiniHud(hudX, effectY + Math.round(clamp(24 * uiScale, 20, 30)));

  if (gamePaused && !gameOver) {
    drawPausedOverlay();
  }

  if (gameOver) {
    const titleFont = Math.round(clamp(38 * uiScale, 30, 48));
    const bodyFont = Math.round(clamp(22 * uiScale, 18, 28));
    const subTextFont = Math.round(clamp(15 * uiScale, 12, 20));
    const goldFont = Math.round(clamp(26 * uiScale, 21, 34));

    const currentEntry = lastSavedEntry || {
      name: playerName,
      score,
      playedAt: new Date().toISOString()
    };
    const topScores = getTopScores(3);
    const cloudTopForScreen = cloudScoresLoaded ? cloudTopScores.slice(0, 3) : [];
    const screenTopScores = cloudScoresLoaded ? cloudTopForScreen : topScores;
    const topEntry = (screenTopScores[0] || topScores[0] || currentEntry);

    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(0, 0, gameWidth, gameHeight);

    const centerX = gameWidth / 2;
    const topY = Math.round(clamp(gameHeight * 0.11, 64, 105));

    ctx.fillStyle = "white";
    ctx.textAlign = "center";
    ctx.font = "bold " + titleFont + "px Arial";
    ctx.fillText("Game Over", centerX, topY);

    ctx.font = bodyFont + "px Arial";
    ctx.fillText("Score: " + score, centerX, topY + Math.round(clamp(38 * uiScale, 32, 45)));

    ctx.font = subTextFont + "px Arial";
    ctx.fillText("Played: " + formatPlayedAt(currentEntry.playedAt), centerX, topY + Math.round(clamp(66 * uiScale, 55, 78)));

    ctx.fillStyle = "#fbbf24";
    ctx.font = "900 " + goldFont + "px Impact, Arial Black, sans-serif";
    ctx.fillText("#1 " + topEntry.name + " - " + topEntry.score, centerX, topY + Math.round(clamp(101 * uiScale, 84, 116)));

    const panelWidth = clamp(gameWidth * 0.9, 300, 760);
    const panelX = (gameWidth - panelWidth) / 2;
    const chartHeight = Math.round(clamp(138 * uiScale, 120, 160));
    const chartY = topY + Math.round(clamp(123 * uiScale, 106, 138));
    drawTotalPointsPieChart(panelX, chartY, panelWidth, chartHeight);

    const tableWidth = panelWidth;
    const rowHeight = Math.round(clamp(28 * uiScale, 23, 34));
    const headerHeight = rowHeight;
    const tableRows = 3;
    const tableHeight = headerHeight + rowHeight * tableRows;
    const tableX = panelX;
    const tableTitleY = chartY + chartHeight + Math.round(clamp(24 * uiScale, 18, 30));
    const tableY = tableTitleY + Math.round(clamp(22 * uiScale, 18, 28));

    ctx.fillStyle = "#f8fafc";
    ctx.font = "800 " + Math.round(clamp(16 * uiScale, 13, 20)) + "px Arial";
    ctx.fillText(cloudScoresLoaded ? "Daily Cloud Top 3" : "Daily Top 3", centerX, tableTitleY);

    ctx.fillStyle = "rgba(15,23,42,0.72)";
    ctx.fillRect(tableX, tableY, tableWidth, tableHeight);
    ctx.strokeStyle = "rgba(255,255,255,0.45)";
    ctx.lineWidth = 1;
    ctx.strokeRect(tableX, tableY, tableWidth, tableHeight);

    const colRank = tableX + tableWidth * 0.09;
    const colUser = tableX + tableWidth * 0.33;
    const colScore = tableX + tableWidth * 0.57;
    const colPlayed = tableX + tableWidth * 0.81;

    ctx.textAlign = "center";
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "700 " + Math.round(clamp(14 * uiScale, 11, 17)) + "px Arial";
    ctx.fillText("Rank", colRank, tableY + headerHeight * 0.66);
    ctx.fillText("User", colUser, tableY + headerHeight * 0.66);
    ctx.fillText("Score", colScore, tableY + headerHeight * 0.66);
    ctx.fillText("Date/Time", colPlayed, tableY + headerHeight * 0.66);

    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    for (let i = 1; i <= tableRows; i += 1) {
      const y = tableY + headerHeight + rowHeight * i;
      ctx.beginPath();
      ctx.moveTo(tableX, y);
      ctx.lineTo(tableX + tableWidth, y);
      ctx.stroke();
    }

    const tableRowsSource = cloudScoresLoaded ? cloudTopScores.slice(0, 3) : topScores.slice();
    const fallbackRows = tableRowsSource.slice();
    while (fallbackRows.length < 3) {
      fallbackRows.push(null);
    }

    fallbackRows.forEach((entry, idx) => {
      const rowCenterY = tableY + headerHeight + rowHeight * idx + rowHeight * 0.66;
      const isTop = idx === 0 && entry;

      ctx.font = (isTop ? "900 " : "700 ") + Math.round(clamp((isTop ? 15 : 13) * uiScale, 11, isTop ? 20 : 17)) + "px Arial";
      ctx.fillStyle = isTop ? "#fbbf24" : "#f8fafc";

      if (!entry) {
        ctx.fillText("-", colRank, rowCenterY);
        ctx.fillText("-", colUser, rowCenterY);
        ctx.fillText("-", colScore, rowCenterY);
        ctx.fillText("-", colPlayed, rowCenterY);
        return;
      }

      ctx.fillText(String(idx + 1), colRank, rowCenterY);
      ctx.fillText(entry.name, colUser, rowCenterY);
      ctx.fillText(String(entry.score), colScore, rowCenterY);
      ctx.fillText(formatPlayedAtShort(entry.playedAt), colPlayed, rowCenterY);
    });

    updateGameOverActionsLayout(tableX, tableY, tableWidth, tableHeight);
    ctx.textAlign = "left";
  } else {
    gameOverActions.style.display = "none";
  }
}


function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}

loop();
