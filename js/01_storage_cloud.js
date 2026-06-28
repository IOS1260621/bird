// ── Storage / accounts ─────────────────────────────────────────────────────
function loadUserAccounts() {
  // V15: only two built-in player accounts are allowed; no password window is shown.
  // Old browser-saved users are ignored so random usernames cannot log in.
  return getFixedUserAccounts();
}

function saveUserAccounts() {
  // Keep localStorage synced, but never allow extra player accounts.
  userAccounts = getFixedUserAccounts();
  localStorage.setItem(USER_ACCOUNTS_KEY, JSON.stringify(userAccounts));
}

function getScoreFileKey(name) {
  return SCORE_FILE_PREFIX + getUserKey(name);
}

function getTopThreeScoresForUser(name) {
  return getScoresForPlayer(name).slice(0, 3);
}

function saveCurrentUserScoreFile() {
  if (!activeUserName) {
    return;
  }

  const top3Scores = getTopThreeScoresForUser(playerName).map(entry => ({
    score: entry.score,
    playedAt: entry.playedAt
  }));
  const todayStats = getTodayStatsForPlayer(playerName) || {
    userName: playerName,
    gamesPlayed: 0,
    highScore: 0,
    totalScore: 0
  };
  const allTimeBest = top3Scores[0] || null;

  const scoreFile = {
    userName: playerName,
    updatedAt: new Date().toISOString(),
    top3Scores,
    todayStats,
    allTimeBest,
    totalGamesToday: todayStats.gamesPlayed || 0,
    totalPointsBattle: getTotalPointsChartData(),
    currentSpriteChoice: getCurrentPlayerSpriteChoice()
  };

  localStorage.setItem(getScoreFileKey(playerName), JSON.stringify(scoreFile, null, 2));
}




function downloadCurrentUserScoreFile() {
  if (!activeUserName) {
    alert("Log in first.");
    return;
  }

  saveCurrentUserScoreFile();
  const raw = localStorage.getItem(getScoreFileKey(playerName)) || "{}";
  downloadJsonText(raw, playerName.replace(/[^a-zA-Z0-9_-]/g, "_") + "_score_file.json");
}





function getLocalStorageKeys(prefix) {
  const keys = [];
  if (typeof localStorage.length === "number" && typeof localStorage.key === "function") {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!prefix || (key && key.startsWith(prefix))) {
        keys.push(key);
      }
    }
    return keys;
  }

  return Object.keys(localStorage).filter(key => !prefix || key.startsWith(prefix));
}

function downloadJsonText(text, filename) {
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

















function initializeDataVersionAndMigrations() {
  const currentVersion = GAME_CONFIG.dataVersion;
  const storedVersion = Number(localStorage.getItem(DATA_VERSION_KEY) || "0");

  // V12 migration note:
  // Existing V6-V11 localStorage records are left intact. The newer systems
  // re-merge permanent global top 3 and per-user top 3 on load.
  if (!Number.isFinite(storedVersion) || storedVersion < currentVersion) {
    localStorage.setItem(DATA_VERSION_KEY, String(currentVersion));
  }
}

function recordMissingAsset(assetName) {
  if (!missingAssetNames.includes(assetName)) {
    missingAssetNames.push(assetName);
  }
  renderMissingAssetWarning();
}

function renderMissingAssetWarning() {
  if (!assetWarning) return;
  if (missingAssetNames.length === 0) {
    assetWarning.style.display = "none";
    assetWarning.textContent = "";
    return;
  }
  assetWarning.style.display = "block";
  assetWarning.textContent = "Missing image file(s): " + missingAssetNames.join(", ");
}

function getHawaiiDayString(date) {
  const d = date || new Date();
  try {
    // Build YYYY-MM-DD manually from Hawaii-time date parts.
    // This avoids iPhone/Safari locale differences like 6/27/2026 vs 2026-06-27.
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Pacific/Honolulu",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(d);

    const values = {};
    parts.forEach(part => {
      values[part.type] = part.value;
    });

    if (values.year && values.month && values.day) {
      return values.year + "-" + values.month + "-" + values.day;
    }
  } catch {
    // Fall back to the device's local day if Intl timezone support fails.
  }
  return getDayString(d);
}

function createEmptyCloudDailyTotals() {
  return {
    chubson: { userName: "Chubson", totalPoints: 0, gamesPlayed: 0, highScore: 0 },
    chubdoo: { userName: "Chubdoo", totalPoints: 0, gamesPlayed: 0, highScore: 0 }
  };
}

function createEmptyCloudLifetimeTotals() {
  return {
    chubson: { userName: "Chubson", lifetimePoints: 0, lifetimeGames: 0, lifetimeHighScore: 0 },
    chubdoo: { userName: "Chubdoo", lifetimePoints: 0, lifetimeGames: 0, lifetimeHighScore: 0 }
  };
}

function normalizeCloudScoreEntry(row) {
  if (!row) {
    return null;
  }

  const userKey = getUserKey(row.player_key || row.player_name || row.name || "");
  if (!isFixedUserKey(userKey)) {
    return null;
  }

  const points = Math.max(0, Math.floor(Number(row.score) || 0));
  return {
    name: FIXED_USER_ACCOUNTS[userKey].userName,
    score: points,
    playedAt: row.played_at || row.playedAt || new Date().toISOString()
  };
}

function updateCloudDailyLeader() {
  const dooPoints = cloudDailyTotals.chubdoo ? Number(cloudDailyTotals.chubdoo.totalPoints) || 0 : 0;
  const sonPoints = cloudDailyTotals.chubson ? Number(cloudDailyTotals.chubson.totalPoints) || 0 : 0;

  if (dooPoints > sonPoints) {
    cloudDailyLeaderKey = "chubdoo";
  } else if (sonPoints > dooPoints) {
    cloudDailyLeaderKey = "chubson";
  } else {
    cloudDailyLeaderKey = "";
  }
}

function addCloudDailyTotalFromScoreRow(totals, row) {
  const userKey = getUserKey(row && (row.player_key || row.player_name || row.name || ""));
  if (!isFixedUserKey(userKey)) {
    return;
  }

  const points = Math.max(0, Math.floor(Number(row.score) || 0));
  if (!totals[userKey]) {
    totals[userKey] = createEmptyCloudDailyTotals()[userKey];
  }
  totals[userKey].userName = FIXED_USER_ACCOUNTS[userKey].userName;
  totals[userKey].totalPoints += points;
  totals[userKey].gamesPlayed += 1;
  totals[userKey].highScore = Math.max(totals[userKey].highScore || 0, points);
}

function addCloudLifetimeTotalFromScoreRow(totals, row) {
  const userKey = getUserKey(row && (row.player_key || row.player_name || row.name || ""));
  if (!isFixedUserKey(userKey)) {
    return;
  }

  const points = Math.max(0, Math.floor(Number(row.score) || 0));
  if (!totals[userKey]) {
    totals[userKey] = createEmptyCloudLifetimeTotals()[userKey];
  }
  totals[userKey].userName = FIXED_USER_ACCOUNTS[userKey].userName;
  totals[userKey].lifetimePoints += points;
  totals[userKey].lifetimeGames += 1;
  totals[userKey].lifetimeHighScore = Math.max(totals[userKey].lifetimeHighScore || 0, points);
}

function isSupabaseRestConfigured() {
  return Boolean(SUPABASE_PROJECT_URL && SUPABASE_PUBLISHABLE_KEY);
}

function getSupabaseRestUrl(pathAndQuery) {
  return SUPABASE_PROJECT_URL.replace(/\/$/, "") + "/rest/v1/" + pathAndQuery;
}

async function supabaseRestRequest(pathAndQuery, options) {
  if (!isSupabaseRestConfigured()) {
    throw new Error("Supabase URL/key missing");
  }

  const requestOptions = options || {};
  const headers = Object.assign({
    apikey: SUPABASE_PUBLISHABLE_KEY,
    Authorization: "Bearer " + SUPABASE_PUBLISHABLE_KEY,
    Accept: "application/json"
  }, requestOptions.headers || {});

  const response = await fetch(getSupabaseRestUrl(pathAndQuery), {
    method: requestOptions.method || "GET",
    headers,
    body: requestOptions.body
  });

  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!response.ok) {
    const message = data && typeof data === "object"
      ? (data.message || data.error || JSON.stringify(data))
      : (text || response.statusText);
    throw new Error("HTTP " + response.status + ": " + String(message).slice(0, 180));
  }

  return data;
}

function loadPendingCloudScoreQueue() {
  try {
    const raw = localStorage.getItem(PENDING_CLOUD_SCORE_QUEUE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(isValidScoreEntry).slice(0, 50) : [];
  } catch {
    return [];
  }
}

function savePendingCloudScoreQueue(queue) {
  pendingCloudScoreQueue = Array.isArray(queue) ? queue.filter(isValidScoreEntry).slice(0, 50) : [];
  localStorage.setItem(PENDING_CLOUD_SCORE_QUEUE_KEY, JSON.stringify(pendingCloudScoreQueue));
}

function queueCloudScoreForRetry(entry) {
  const queue = loadPendingCloudScoreQueue();
  const key = getScoreEntryKey(entry);
  if (!queue.some(item => getScoreEntryKey(item) === key)) {
    queue.unshift(entry);
  }
  savePendingCloudScoreQueue(queue);
}

async function retryPendingCloudScores() {
  const queue = loadPendingCloudScoreQueue();
  if (!queue.length || !isSupabaseRestConfigured()) {
    return;
  }

  const stillPending = [];
  for (const entry of queue.slice().reverse()) {
    const ok = await saveScoreToServer(entry, { fromRetry: true, skipQueue: true });
    if (!ok) {
      stillPending.push(entry);
    }
  }
  savePendingCloudScoreQueue(stillPending.reverse());
}

function getCloudStatusText() {
  if (cloudLastErrorDetail) {
    return cloudLastErrorDetail;
  }
  if (cloudLastSavedScoreText) {
    return cloudLastSavedScoreText;
  }
  if (cloudLastLoadStatus) {
    return cloudLastLoadStatus;
  }
  return cloudScoresLoaded ? "Cloud connected" : "Cloud not loaded";
}

function isActiveRoundInProgress() {
  return Boolean(gameStarted && !gameOver && !gamePaused && !backgroundSwapPending);
}

function requestCloudScoreRefresh() {
  if (isActiveRoundInProgress()) {
    cloudRefreshPendingAfterRound = true;
    return;
  }
  loadCloudScores().then(() => retryPendingCloudScores());
}

function refreshCloudScoresAfterRoundIfNeeded() {
  if (cloudRefreshPendingAfterRound && !isActiveRoundInProgress()) {
    cloudRefreshPendingAfterRound = false;
    loadCloudScores().then(() => retryPendingCloudScores());
  }
}

async function loadCloudScores() {
  if (isActiveRoundInProgress()) {
    cloudRefreshPendingAfterRound = true;
    return;
  }

  if (!isSupabaseRestConfigured()) {
    cloudScoresLoaded = false;
    cloudTodayScores = [];
    cloudLastLoadStatus = "Cloud not configured";
    cloudLastErrorDetail = "";
    draw();
    return;
  }

  const today = getHawaiiDayString();
  try {
    const todayQuery = "game_scores?select=player_key,player_name,score,played_at,game_day" +
      "&game_day=eq." + encodeURIComponent(today) +
      "&order=score.desc" +
      "&order=played_at.asc" +
      "&limit=1000";
    const todayRows = await supabaseRestRequest(todayQuery);

    const dailyTotals = createEmptyCloudDailyTotals();
    const safeTodayRows = Array.isArray(todayRows) ? todayRows : [];
    safeTodayRows.forEach(row => addCloudDailyTotalFromScoreRow(dailyTotals, row));
    cloudDailyTotals = dailyTotals;
    cloudTodayScores = safeTodayRows
      .map(normalizeCloudScoreEntry)
      .filter(Boolean)
      .sort((a, b) => getPlayedAtTime(b) - getPlayedAtTime(a));
    cloudTopScores = cloudTodayScores
      .slice()
      .sort(compareScoreEntries)
      .slice(0, 20);

    const allRows = await supabaseRestRequest(
      "game_scores?select=player_key,player_name,score,played_at,game_day" +
      "&order=played_at.desc" +
      "&limit=10000"
    );

    const lifetimeTotals = createEmptyCloudLifetimeTotals();
    const safeAllRows = Array.isArray(allRows) ? allRows : [];
    safeAllRows.forEach(row => addCloudLifetimeTotalFromScoreRow(lifetimeTotals, row));
    cloudLifetimeTotals = lifetimeTotals;

    cloudScoresLoaded = true;
    cloudScoresLastLoadedAt = Date.now();
    cloudLastLoadStatus = "Cloud connected: " + safeTodayRows.length + " score row(s) today";
    cloudLastErrorDetail = "";
    updateCloudDailyLeader();
    renderScoreHistory();
    if (todayScoresModal && todayScoresModal.style.display === "flex") {
      renderTodayScoresModal();
    }
    draw();
  } catch (error) {
    console.warn("Cloud score load error:", error);
    cloudScoresLoaded = false;
    cloudTodayScores = [];
    cloudLastLoadStatus = "Cloud load failed";
    cloudLastErrorDetail = "Cloud load failed: " + (error && error.message ? error.message : String(error));
    renderScoreHistory();
    draw();
  }
}

async function saveScoreToServer(entry, options) {
  const opts = options || {};
  if (!entry) {
    return false;
  }

  if (!isSupabaseRestConfigured()) {
    cloudLastSaveStatus = "Cloud save skipped: Supabase not configured";
    cloudLastErrorDetail = cloudLastSaveStatus;
    if (!opts.skipQueue) queueCloudScoreForRetry(entry);
    draw();
    return false;
  }

  const userKey = getUserKey(entry.name || playerName || "");
  if (!isFixedUserKey(userKey)) {
    cloudLastSaveStatus = "Cloud save skipped: invalid player";
    cloudLastErrorDetail = cloudLastSaveStatus;
    draw();
    return false;
  }

  const cleanScore = Math.max(0, Math.floor(Number(entry.score) || 0));
  const playedAt = entry.playedAt || new Date().toISOString();
  const payload = {
    player_key: userKey,
    player_name: FIXED_USER_ACCOUNTS[userKey].userName,
    score: cleanScore,
    game_day: getHawaiiDayString(new Date(playedAt)),
    played_at: playedAt
  };

  const metadataPayload = {
    ...payload,
    selected_character: entry.selectedCharacter || currentSprite || "",
    difficulty_settings_version: entry.pipeSettingsVersion || PIPE_SETTINGS_VERSION,
    difficulty_phase: entry.difficultyPhaseAtDeath || getDifficulty(cleanScore).name,
    death_score: cleanScore,
    death_pipe_number: Math.max(0, Math.floor(Number(entry.deathPipeNumber) || totalPipesCreated || 0)),
    device_type: entry.deviceType || getDeviceType(),
    attempt_number: Math.max(0, Math.floor(Number(entry.attemptNumber) || currentAttemptNumber || 0)),
    background_photo_mode: entry.backgroundPhotoMode || (shouldUseBackgroundPhoto() ? "photo_reveal" : "no_background"),
    god_mode_bonus_used: Boolean(entry.godModeBonusUsed),
    mystery_effect_at_death: entry.mysteryEffectAtDeath || deathEffectLabel || "None",
    gap_pattern_at_death: entry.gapPatternAtDeath || lastGapPatternName || currentGapPatternName || "None",
    pattern_difficulty_at_death: Math.max(0, Math.floor(Number(entry.patternDifficultyAtDeath || lastGapPatternDifficulty || currentGapPatternDifficulty) || 0))
  };

  cloudLastSaveStatus = "Cloud save: saving " + payload.player_name + " " + cleanScore + "...";
  cloudLastErrorDetail = "";
  draw();

  try {
    try {
      await supabaseRestRequest("game_scores", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Prefer: "return=representation"
        },
        body: JSON.stringify(metadataPayload)
      });
    } catch (metadataError) {
      // If the database has not been upgraded with the optional analytics columns yet,
      // keep the game working by saving the basic score row.
      if (!isMissingMetadataColumnError(metadataError)) {
        throw metadataError;
      }
      console.warn("Cloud score metadata columns missing; saved basic score only:", metadataError);
      await supabaseRestRequest("game_scores", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Prefer: "return=representation"
        },
        body: JSON.stringify(payload)
      });
    }

    cloudLastSaveStatus = "Cloud save OK";
    cloudLastSavedScoreText = "Cloud saved: " + payload.player_name + " +" + cleanScore + " pts";
    cloudLastErrorDetail = "";
    if (!opts.fromRetry) {
      const queue = loadPendingCloudScoreQueue().filter(item => getScoreEntryKey(item) !== getScoreEntryKey(entry));
      savePendingCloudScoreQueue(queue);
    }
    await loadCloudScores();
    return true;
  } catch (error) {
    console.warn("Cloud score save error:", error);
    cloudLastSaveStatus = "Cloud save failed";
    cloudLastErrorDetail = "Cloud save failed: " + (error && error.message ? error.message : String(error));
    if (!opts.skipQueue) {
      queueCloudScoreForRetry(entry);
    }
    draw();
    return false;
  }
}

function subscribeToCloudScores() {
  if (!supabaseClient || cloudRealtimeChannel) {
    return;
  }

  try {
    cloudRealtimeChannel = supabaseClient
      .channel("bouncing-bruce-cloud-scores")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "game_scores" },
        () => requestCloudScoreRefresh()
      )
      .subscribe();
  } catch (error) {
    console.warn("Supabase realtime setup failed:", error);
  }
}

function isPauseButtonRightEnabled() {
  return localStorage.getItem(PAUSE_BUTTON_RIGHT_KEY) === "true";
}

function savePauseButtonSidePreference(isRightSide) {
  localStorage.setItem(PAUSE_BUTTON_RIGHT_KEY, isRightSide ? "true" : "false");
}

function applyPauseButtonSidePreference() {
  const isRightSide = isPauseButtonRightEnabled();
  if (pauseRightCheckbox) {
    pauseRightCheckbox.checked = isRightSide;
  }
  if (pauseGameButton) {
    pauseGameButton.classList.toggle("pause-right", isRightSide);
  }
}

function isNoBackgroundPhotoEnabled() {
  return Boolean(noBackgroundPhotoCheckbox && noBackgroundPhotoCheckbox.checked);
}

function saveNoBackgroundPhotoPreference() {
  localStorage.setItem(NO_BACKGROUND_PHOTO_KEY, isNoBackgroundPhotoEnabled() ? "true" : "false");
}

function applyNoBackgroundPhotoPreference() {
  if (!noBackgroundPhotoCheckbox) {
    return;
  }
  // V38: default gameplay is no background photo reveal.
  // Picking a photo in Settings temporarily turns this off for that session.
  noBackgroundPhotoCheckbox.checked = true;
  localStorage.setItem(NO_BACKGROUND_PHOTO_KEY, "true");
  updateStartButtonState();
}

function shouldUseBackgroundPhoto() {
  return Boolean(revealImageReady && !isNoBackgroundPhotoEnabled());
}

function canStartCurrentRound() {
  return Boolean(activeUserName && (revealImageReady || isNoBackgroundPhotoEnabled()));
}

function renderPlayerButtons() {
  const selectedKey = gameStarted ? getUserKey(playerName) : "";
  if (chooseChubsonButton) {
    chooseChubsonButton.classList.toggle("selected", selectedKey === "chubson");
  }
  if (chooseChubdooButton) {
    chooseChubdooButton.classList.toggle("selected", selectedKey === "chubdoo");
  }
}

function renderAuthStatus() {
  // V30: no password/login window. Players choose Chubdoo or Chubson directly.
  if (!activeUserName) {
    activeUserName = "Chubdoo";
    playerName = "Chubdoo";
    localStorage.setItem(ACTIVE_USER_KEY, activeUserName);
  }

  updateStartButtonState();
  renderPlayerButtons();
  updatePauseButtonVisibility();
}

function selectFixedPlayer(name) {
  const userKey = getUserKey(name);
  const account = userAccounts[userKey] || FIXED_USER_ACCOUNTS[userKey];

  if (!account || !isAllowedPlayerName(account.userName)) {
    return;
  }

  // Do not switch players in the middle of an active round.
  if (gameStarted && !gameOver) {
    return;
  }

  activeUserName = account.userName;
  playerName = account.userName;
  localStorage.setItem(ACTIVE_USER_KEY, activeUserName);
  gameStarted = false;
  gameOver = false;
  gamePaused = false;

  renderScoreHistory();
  renderAuthStatus();
  applyCurrentPlayerSprite();
  updateStartButtonLabel();
  updateHudVisibility();
  draw();
}

function selectFixedPlayerAndStart(name) {
  if (gameStarted && !gameOver) {
    return;
  }
  selectFixedPlayer(name);
  startGame();
}









function logoutAccount() {
  // V15: this button now returns to the player-choice menu instead of logging out.
  gameStarted = false;
  gameOver = false;
  gamePaused = false;

  if (!activeUserName || !isAllowedPlayerName(activeUserName)) {
    activeUserName = "Chubdoo";
    playerName = "Chubdoo";
    localStorage.setItem(ACTIVE_USER_KEY, activeUserName);
  }

  renderScoreHistory();
  renderAuthStatus();
  applyCurrentPlayerSprite();
  updateStartButtonLabel();
  updateHudVisibility();
}
