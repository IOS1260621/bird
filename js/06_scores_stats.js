// ── Score system ───────────────────────────────────────────────────────────
function loadTop3Forever() {
  try {
    const raw = localStorage.getItem(TOP3_FOREVER_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    const today = getDayString();
    return mergeScoreEntries(parsed.filter(entry => isScoreEntryFromDay(entry, today))).slice(0, 3);
  } catch {
    return [];
  }
}

function saveTop3Forever(entries) {
  localStorage.setItem(TOP3_FOREVER_KEY, JSON.stringify(entries));
}

function updateTop3Forever() {
  const forever = loadTop3Forever();
  const combined = mergeScoreEntries(scoreHistory, forever);
  saveTop3Forever(combined.slice(0, 3));
}

function loadScoreHistory() {
  try {
    const raw = localStorage.getItem(SCORE_HISTORY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) {
      return [];
    }

    const today = getDayString();
    const entries = parsed
      .filter(entry => isValidScoreEntry(entry) && isScoreEntryFromDay(entry, today))
      .slice(0, GAME_CONFIG.maxScoreHistoryEntries);

    // V30 daily-only scoreboard: merge only today's top records, never older days.
    return mergeScoreEntries(entries, loadTop3Forever()).slice(0, GAME_CONFIG.maxScoreHistoryEntries);
  } catch {
    return [];
  }
}

function saveScoreHistory() {
  localStorage.setItem(SCORE_HISTORY_KEY, JSON.stringify(scoreHistory.slice(0, GAME_CONFIG.maxScoreHistoryEntries)));
  updateTop3Forever();
  updatePerUserTop3Forever();
  saveCurrentUserScoreFile();
}

function purgeInactiveAccounts() {
  const now = Date.now();
  let changed = false;

  Object.keys(userAccounts).forEach(key => {
    const account = userAccounts[key];
    const activityIso = account.lastActivity || account.createdAt;
    if (!activityIso) return;
    const activityTime = new Date(activityIso).getTime();
    if (!Number.isFinite(activityTime)) return;
    if (isFixedUserKey(key)) return;
    if ((now - activityTime) / MS_PER_DAY > INACTIVITY_DAYS) {
      const userKey = normalizedName(account.userName);
      scoreHistory = scoreHistory.filter(entry => normalizedName(entry.name) !== userKey);
      localStorage.removeItem(getScoreFileKey(account.userName));
      delete spriteChoicesByUser[userKey];
      delete userAccounts[key];
      changed = true;
    }
  });

  if (changed) {
    saveUserAccounts();
    saveSpriteChoices();
    // Write purged history, then reload to re-merge top-3-forever records.
    localStorage.setItem(SCORE_HISTORY_KEY, JSON.stringify(scoreHistory.slice(0, GAME_CONFIG.maxScoreHistoryEntries)));
    scoreHistory = loadScoreHistory();
  }
}

// ── Daily date helpers ────────────────────────────────────────────────────────

function getDayString(date) {
  const d = date || new Date();
  return d.getFullYear() + "-" +
    String(d.getMonth() + 1).padStart(2, "0") + "-" +
    String(d.getDate()).padStart(2, "0");
}

function isScoreEntryFromDay(entry, dayString) {
  if (!entry || typeof entry.playedAt !== "string") {
    return false;
  }

  const playedAt = new Date(entry.playedAt);
  if (Number.isNaN(playedAt.getTime())) {
    return false;
  }

  return getDayString(playedAt) === dayString;
}

// ── Daily activity stats (per-user database stored in localStorage) ───────────

function loadDailyStats() {
  try {
    const raw = localStorage.getItem(DAILY_STATS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed;
  } catch {
    return {};
  }
}

function saveDailyStats(stats) {
  // V30 daily-only scoreboard: keep only today's stats.
  const today = getDayString();
  Object.keys(stats).forEach(day => {
    if (day !== today) {
      delete stats[day];
    }
  });
  localStorage.setItem(DAILY_STATS_KEY, JSON.stringify(stats));
}

function recordDailyActivity(name, roundScore) {
  const stats = loadDailyStats();
  const today = getDayString();
  const userKey = normalizedName(name);
  if (!stats[today]) stats[today] = {};
  if (!stats[today][userKey]) {
    stats[today][userKey] = { userName: name, gamesPlayed: 0, highScore: 0, totalScore: 0 };
  }
  const entry = stats[today][userKey];
  entry.gamesPlayed += 1;
  entry.totalScore += roundScore;
  if (roundScore > entry.highScore) entry.highScore = roundScore;
  entry.userName = name;
  saveDailyStats(stats);
}

function getTodayStatsForPlayer(name) {
  const stats = loadDailyStats();
  const today = getDayString();
  return (stats[today] && stats[today][normalizedName(name)]) || null;
}


// ── Total points battle stats ───────────────────────────────────────────────

function createEmptyTotalPointsByUser() {
  return {
    chubson: { userName: "Chubson", totalPoints: 0, gamesPlayed: 0 },
    chubdoo: { userName: "Chubdoo", totalPoints: 0, gamesPlayed: 0 }
  };
}

function loadTotalPointsByUser() {
  const totals = createEmptyTotalPointsByUser();

  // V30 daily-only scoreboard: old total-points battle data expires at midnight.
  if (localStorage.getItem(TOTAL_POINTS_DATE_KEY) !== getDayString()) {
    return totals;
  }

  try {
    const raw = localStorage.getItem(TOTAL_POINTS_BY_USER_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return totals;
    }

    Object.keys(totals).forEach(userKey => {
      const saved = parsed[userKey];
      if (typeof saved === "number") {
        totals[userKey].totalPoints = Math.max(0, Math.floor(saved));
        return;
      }
      if (saved && typeof saved === "object") {
        totals[userKey].totalPoints = Math.max(0, Math.floor(Number(saved.totalPoints) || 0));
        totals[userKey].gamesPlayed = Math.max(0, Math.floor(Number(saved.gamesPlayed) || 0));
      }
    });
  } catch {
    return totals;
  }

  return totals;
}

function saveTotalPointsByUser(totals) {
  localStorage.setItem(TOTAL_POINTS_BY_USER_KEY, JSON.stringify(totals));
  localStorage.setItem(TOTAL_POINTS_DATE_KEY, getDayString());
}

function updateTotalPointsForPlayer(name, roundScore) {
  const userKey = getUserKey(name);
  if (!isFixedUserKey(userKey)) {
    return;
  }

  const totals = loadTotalPointsByUser();
  if (!totals[userKey]) {
    totals[userKey] = {
      userName: FIXED_USER_ACCOUNTS[userKey].userName,
      totalPoints: 0,
      gamesPlayed: 0
    };
  }

  totals[userKey].userName = FIXED_USER_ACCOUNTS[userKey].userName;
  totals[userKey].totalPoints += Math.max(0, Math.floor(Number(roundScore) || 0));
  totals[userKey].gamesPlayed += 1;
  saveTotalPointsByUser(totals);
}

function getTotalPointsChartData() {
  if (cloudScoresLoaded) {
    return ["chubson", "chubdoo"].map(userKey => {
      const daily = cloudDailyTotals[userKey] || createEmptyCloudDailyTotals()[userKey];
      const lifetime = cloudLifetimeTotals[userKey] || createEmptyCloudLifetimeTotals()[userKey];
      return {
        userKey,
        userName: FIXED_USER_ACCOUNTS[userKey].userName,
        totalPoints: daily.totalPoints || 0,
        gamesPlayed: daily.gamesPlayed || 0,
        highScore: daily.highScore || 0,
        lifetimePoints: lifetime.lifetimePoints || 0,
        lifetimeGames: lifetime.lifetimeGames || 0,
        lifetimeHighScore: lifetime.lifetimeHighScore || 0
      };
    });
  }

  const totals = loadTotalPointsByUser();
  return ["chubson", "chubdoo"].map(userKey => ({
    userKey,
    userName: totals[userKey].userName,
    totalPoints: totals[userKey].totalPoints || 0,
    gamesPlayed: totals[userKey].gamesPlayed || 0,
    lifetimePoints: 0,
    lifetimeGames: 0,
    lifetimeHighScore: 0
  }));
}

function getTotalBattlePoints() {
  return getTotalPointsChartData().reduce((sum, item) => sum + item.totalPoints, 0);
}


function initializeTotalPointsFromKnownScores() {
  if (localStorage.getItem(TOTAL_POINTS_BY_USER_KEY) && localStorage.getItem(TOTAL_POINTS_DATE_KEY) === getDayString()) {
    return;
  }

  const totals = createEmptyTotalPointsByUser();
  const today = getDayString();
  scoreHistory
    .filter(entry => isValidScoreEntry(entry) && isScoreEntryFromDay(entry, today))
    .forEach(entry => {
      const userKey = getUserKey(entry.name);
      if (!isFixedUserKey(userKey)) {
        return;
      }
      totals[userKey].totalPoints += Math.max(0, Math.floor(Number(entry.score) || 0));
      totals[userKey].gamesPlayed += 1;
    });
  saveTotalPointsByUser(totals);
}

// ── Midnight score reset ──────────────────────────────────────────────────────

function clearScoreDataForNewDay() {
  // V30 daily-only scoreboard: reset all score and pie-chart data at local midnight.
  localStorage.setItem(SCORE_HISTORY_KEY, JSON.stringify([]));
  localStorage.setItem(TOP3_FOREVER_KEY, JSON.stringify([]));
  localStorage.setItem(PER_USER_TOP3_FOREVER_KEY, JSON.stringify({}));
  localStorage.setItem(DAILY_STATS_KEY, JSON.stringify({}));
  localStorage.removeItem(TOTAL_POINTS_BY_USER_KEY);
  localStorage.removeItem(TOTAL_POINTS_DATE_KEY);
  getLocalStorageKeys(SCORE_FILE_PREFIX).forEach(key => localStorage.removeItem(key));
  scoreHistory = [];
}

function maybeResetScoresNightly() {
  const today = getDayString();
  const lastReset = localStorage.getItem(LAST_RESET_DATE_KEY) || "";

  if (!lastReset) {
    // First run under the daily-only system: mark today without clearing current play.
    localStorage.setItem(LAST_RESET_DATE_KEY, today);
  } else if (lastReset !== today) {
    clearScoreDataForNewDay();
    localStorage.setItem(LAST_RESET_DATE_KEY, today);
    initializeTotalPointsFromKnownScores();
    saveCurrentUserScoreFile();
    renderScoreHistory();
  }

  // Schedule next check 5 s after the next calendar midnight.
  const now = new Date();
  const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 5);
  setTimeout(maybeResetScoresNightly, nextMidnight.getTime() - now.getTime());
}

function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatScoreTimeOnly(isoTime) {
  const date = new Date(isoTime);
  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function getTodayScoresForModal() {
  if (cloudScoresLoaded) {
    return cloudTodayScores.slice();
  }

  const today = getDayString();
  return scoreHistory
    .filter(entry => isValidScoreEntry(entry) && isScoreEntryFromDay(entry, today))
    .sort((a, b) => getPlayedAtTime(b) - getPlayedAtTime(a));
}

function getTodaySummaryForModal(rows) {
  const summary = createEmptyCloudDailyTotals();
  rows.forEach(row => {
    const userKey = getUserKey(row && (row.name || row.player_name || row.player_key || ""));
    if (!isFixedUserKey(userKey)) {
      return;
    }
    const points = Math.max(0, Math.floor(Number(row.score) || 0));
    summary[userKey].totalPoints += points;
    summary[userKey].gamesPlayed += 1;
    summary[userKey].highScore = Math.max(summary[userKey].highScore || 0, points);
  });
  return summary;
}

function renderTodayScoresModal() {
  if (!todayScoresContent) {
    return;
  }

  const rows = getTodayScoresForModal();
  const summary = cloudScoresLoaded ? cloudDailyTotals : getTodaySummaryForModal(rows);
  const today = getHawaiiDayString();
  const sourceLabel = cloudScoresLoaded ? "Cloud scores" : "Local scores only";

  if (todayScoresSubtitle) {
    todayScoresSubtitle.textContent = sourceLabel + " • Hawaii day " + today;
  }

  const doo = summary.chubdoo || createEmptyCloudDailyTotals().chubdoo;
  const son = summary.chubson || createEmptyCloudDailyTotals().chubson;
  const cards = [doo, son].map(item => `
    <div class="today-score-summary-card">
      <div class="today-score-summary-name">${escapeHtml(item.userName)}</div>
      <div class="today-score-summary-line">Picked / games played: ${Number(item.gamesPlayed) || 0}</div>
      <div class="today-score-summary-line">Total points: ${Number(item.totalPoints) || 0}</div>
      <div class="today-score-summary-line">Highest score: ${Number(item.highScore) || 0}</div>
    </div>
  `).join("");

  const rowsHtml = rows.length
    ? rows.map((entry, idx) => `
        <tr>
          <td>${idx + 1}</td>
          <td>${escapeHtml(entry.name)}</td>
          <td>${Number(entry.score) || 0}</td>
          <td>${escapeHtml(formatScoreTimeOnly(entry.playedAt))}</td>
        </tr>
      `).join("")
    : `<tr><td colspan="4">No scores saved for today yet.</td></tr>`;

  todayScoresContent.innerHTML = `
    <div class="today-scores-grid">${cards}</div>
    <div class="today-scores-table-wrap">
      <table class="today-scores-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Player</th>
            <th>Score</th>
            <th>Time</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>
  `;
}

async function showTodayScoresModal() {
  if (!todayScoresModal || !todayScoresContent) {
    return;
  }

  todayScoresModal.style.display = "flex";
  todayScoresContent.textContent = "Loading today scores...";
  if (!isActiveRoundInProgress()) {
    await loadCloudScores();
  }
  renderTodayScoresModal();
}

function hideTodayScoresModal() {
  if (todayScoresModal) {
    todayScoresModal.style.display = "none";
  }
}

function renderScoreHistory() {
  // V17: no visible statistics on the start screen.
  // Scores are saved for today only, including the Game Over pie chart and score files.
  if (scoreList) scoreList.innerHTML = "";
  if (scoreListTitle) scoreListTitle.textContent = "";
  applyCurrentPlayerSprite();
  renderPlayerButtons();
}

function updateStartButtonLabel() {
  startGameButton.textContent = gameOver ? "Play Again" : "Start Game";
}

function updateHudVisibility() {
  const showStartupControls = !gameStarted || !activeUserName;
  hudPanel.style.display = showStartupControls ? "block" : "none";
  if (!gameOver) {
    gameOverActions.style.display = "none";
  }
  if (!backgroundSwapPending) {
    hideHundredPhotoPrompt();
  }
  updateStartButtonState();
  updatePauseButtonVisibility();
}



function updateGameOverActionsLayout(tableX, tableY, tableWidth, tableHeight) {
  const actionsWidth = Math.min(tableWidth, 420);
  const left = (gameWidth - actionsWidth) / 2;
  const top = Math.min(
    gameHeight - 64,
    tableY + tableHeight + Math.round(clamp(20 * uiScale, 16, 28))
  );

  gameOverActions.style.display = "flex";
  gameOverActions.style.width = Math.round(actionsWidth) + "px";
  gameOverActions.style.left = Math.round(left) + "px";
  gameOverActions.style.top = Math.round(top) + "px";
}


function updatePauseButtonVisibility() {
  applyPauseButtonSidePreference();
  pauseGameButton.style.display = gameStarted && !gameOver && activeUserName && !backgroundSwapPending ? "block" : "none";
  pauseGameButton.textContent = gamePaused ? "Resume" : "Pause";
}

function togglePause() {
  if (!gameStarted || gameOver || !activeUserName) return;
  gamePaused = !gamePaused;
  updatePauseButtonVisibility();
  draw();
}
