// ── Game state ─────────────────────────────────────────────────────────────
function resetRoundState() {
  bird.y = gameHeight / 2;
  bird.velocity = 0;
  pipes = [];
  score = 0;
  gameOver = false;
  gamePaused = false;
  scoreSavedForRound = false;
  lastSavedEntry = null;
  totalPipesCreated = 0;
  lastPipeGapY = Number.NaN;
  currentRoundTopScorerBonusGranted = false;
  currentRoundIsDevMode = false;
  currentRoundDevSettingsSnapshot = null;
  resetGapPatternState();
  mysteryBox = null;
  lastRoundEffectLabel = "None";
  deathEffectLabel = "None";
  firstMysteryQueued = false;
  nextMysteryScoreThreshold = GAME_CONFIG.firstMysteryScore;
  invincibleUntil = 0;
  godModeCharges = 0;
  activeEffects = { size: null, speed: null };
  speedMultiplier = 1;
  sizeMultiplier = 1;
  recalculateBirdSize();
  keepCurrentPhotoFullyRevealed = false;
  resetImageRevealPuzzle();
  backgroundSwapPending = false;
  pendingHundredScore = 0;
  nextPhotoMilestoneScore = 100;
  hideHundredPhotoPrompt();
  updatePauseButtonVisibility();
}



function grantTopScorerStartingGodMode() {
  if (isCurrentPlayerTopScorer()) {
    addGodModeCharge();
    currentRoundTopScorerBonusGranted = true;
  }
}



function startGame() {
  applyPlayerNameFromInput();
  if (!activeUserName) {
    alert("Choose Chubson or Chubdoo before starting the game.");
    return;
  }
  if (!revealImageReady && !isNoBackgroundPhotoEnabled()) {
    alert("Choose a photo in Settings or play with no background photo.");
    return;
  }
  chooseRandomSprite();
  currentAttemptNumber = getNextAttemptNumber();
  const devModeAtStart = isDeveloperModeActive();
  const devSettingsAtStart = getCurrentDevSettings();
  resetRoundState();
  currentRoundIsDevMode = devModeAtStart;
  currentRoundDevSettingsSnapshot = devSettingsAtStart;
  placeBruceAtCenterForImageReveal();
  activateImagePickGodMode();
  grantTopScorerStartingGodMode();
  gameStarted = true;
  gamePaused = false;
  updateStartButtonLabel();
  updateHudVisibility();
  updatePauseButtonVisibility();
}



function applyPlayerNameFromInput() {
  if (!activeUserName) {
    renderScoreHistory();
    renderAuthStatus();
    updateHudVisibility();
    return;
  }

  playerName = activeUserName;
  renderScoreHistory();
  renderAuthStatus();
  applyCurrentPlayerSprite();
  updateHudVisibility();
}

function persistCurrentScore() {
  if (scoreSavedForRound) {
    return;
  }

  scoreSavedForRound = true;

  if (isRoundDevMode()) {
    const difficultyAtDeath = getDifficulty(score);
    lastSavedEntry = {
      name: playerName,
      score,
      playedAt: new Date().toISOString(),
      selectedCharacter: currentSprite,
      pipeSettingsVersion: PIPE_SETTINGS_VERSION,
      difficultyPhaseAtDeath: difficultyAtDeath.name,
      deathScore: score,
      deathPipeNumber: totalPipesCreated,
      deviceType: getDeviceType(),
      attemptNumber: currentAttemptNumber,
      backgroundPhotoMode: shouldUseBackgroundPhoto() ? "photo_reveal" : "no_background",
      godModeBonusUsed: currentRoundTopScorerBonusGranted,
      mysteryEffectAtDeath: deathEffectLabel || getEffectLabelForDeath(),
      gapPatternAtDeath: lastGapPatternName || currentGapPatternName || "None",
      patternDifficultyAtDeath: Math.max(0, Math.floor(Number(lastGapPatternDifficulty || currentGapPatternDifficulty) || 0)),
      devMode: true,
      devSettings: currentRoundDevSettingsSnapshot || getCurrentDevSettings()
    };
    cloudLastSaveStatus = "DEV MODE: score not saved";
    cloudLastSavedScoreText = "Admin test score not saved: " + playerName + " " + score;
    cloudLastErrorDetail = "Developer Mode was active. This score does not count.";
    renderScoreHistory();
    applyCurrentPlayerSprite();
    draw();
    return;
  }

  const difficultyAtDeath = getDifficulty(score);
  lastSavedEntry = {
    name: playerName,
    score,
    playedAt: new Date().toISOString(),
    selectedCharacter: currentSprite,
    pipeSettingsVersion: PIPE_SETTINGS_VERSION,
    difficultyPhaseAtDeath: difficultyAtDeath.name,
    deathScore: score,
    deathPipeNumber: totalPipesCreated,
    deviceType: getDeviceType(),
    attemptNumber: currentAttemptNumber,
    backgroundPhotoMode: shouldUseBackgroundPhoto() ? "photo_reveal" : "no_background",
    godModeBonusUsed: currentRoundTopScorerBonusGranted,
    mysteryEffectAtDeath: deathEffectLabel || getEffectLabelForDeath(),
    gapPatternAtDeath: lastGapPatternName || currentGapPatternName || "None",
    patternDifficultyAtDeath: Math.max(0, Math.floor(Number(lastGapPatternDifficulty || currentGapPatternDifficulty) || 0))
  };
  scoreHistory.unshift(lastSavedEntry);
  scoreHistory = scoreHistory.slice(0, GAME_CONFIG.maxScoreHistoryEntries);
  updateTotalPointsForPlayer(playerName, score);
  recordDailyActivity(playerName, score);
  saveScoreHistory();
  cloudLastSaveStatus = "Cloud save: queued " + playerName + " " + score;
  cloudLastSavedScoreText = "";
  cloudLastErrorDetail = "";
  saveScoreToServer(lastSavedEntry).then(ok => {
    if (!ok) {
      console.warn("Score is saved locally and queued for cloud retry.");
    }
  });

  // Refresh last-activity so this user's data won't expire for another 14 days.
  const actKey = getUserKey(playerName);
  if (userAccounts[actKey]) {
    userAccounts[actKey].lastActivity = new Date().toISOString();
    saveUserAccounts();
  }

  renderScoreHistory();
  applyCurrentPlayerSprite();
}

function setGameOver() {
  if (gameOver) {
    return;
  }
  deathEffectLabel = getEffectLabelForDeath();
  gameOver = true;
  gamePaused = false;
  persistCurrentScore();
  updateStartButtonLabel();
  updateHudVisibility();
  updatePauseButtonVisibility();
  refreshCloudScoresAfterRoundIfNeeded();
}



chooseChubsonButton.addEventListener("click", () => selectFixedPlayerAndStart("Chubson"));
chooseChubdooButton.addEventListener("click", () => selectFixedPlayerAndStart("Chubdoo"));
pauseGameButton.addEventListener("click", togglePause);
if (pauseRightCheckbox) {
  pauseRightCheckbox.addEventListener("change", () => {
    savePauseButtonSidePreference(pauseRightCheckbox.checked);
    applyPauseButtonSidePreference();
  });
}
gameOverLogoutButton.addEventListener("click", logoutAccount);
gameOverPlayAgainButton.addEventListener("click", startGame);
imageUploadInput.addEventListener("change", handleImageUpload);
if (noBackgroundPhotoCheckbox) {
  noBackgroundPhotoCheckbox.addEventListener("change", () => {
    saveNoBackgroundPhotoPreference();
    updateStartButtonState();
  });
}
if (todayScoresButton) {
  todayScoresButton.addEventListener("click", showTodayScoresModal);
}
if (todayScoresCloseButton) {
  todayScoresCloseButton.addEventListener("click", hideTodayScoresModal);
}
if (todayScoresRefreshButton) {
  todayScoresRefreshButton.addEventListener("click", showTodayScoresModal);
}
if (todayScoresModal) {
  todayScoresModal.addEventListener("click", event => {
    if (event.target === todayScoresModal) {
      hideTodayScoresModal();
    }
  });
}
hundredPhotoPickButton.addEventListener("click", () => {
  if (hundredImageUploadInput) {
    hundredImageUploadInput.click();
  }
});
hundredImageUploadInput.addEventListener("change", handleHundredImageUpload);
hundredPhotoContinueButton.addEventListener("click", continueWithSamePictureAfterHundred);
if (hundredPhotoStartButton) {
  hundredPhotoStartButton.addEventListener("click", () => {
    if (backgroundSwapPending && revealImageReady) {
      resumeAfterHundredPhotoChange();
    }
  });
}
if (randomSpriteButton) {
  randomSpriteButton.addEventListener("click", chooseRandomSprite);
}
if (resetSpriteButton) {
  resetSpriteButton.addEventListener("click", resetSpriteChoiceToDefault);
}
if (spritePicker) {
  spritePicker.addEventListener("change", () => {
    if (!activeUserName) {
      return;
    }

    applySpriteChoice(spritePicker.value);
  });
}
startGameButton.addEventListener("click", startGame);

if (selectedSpritePreviewImage) {
  selectedSpritePreviewImage.addEventListener("error", () => {
    if (selectedSpritePreviewImage.getAttribute("src") !== DEFAULT_DOG_SPRITE) {
      selectedSpritePreviewImage.src = DEFAULT_DOG_SPRITE;
      selectedSpritePreviewImage.alt = "Selected Bruce sprite: " + DEFAULT_DOG_SPRITE;
      if (selectedSpriteLabel) {
        selectedSpriteLabel.textContent = "Selected: " + DEFAULT_DOG_SPRITE + " (fallback)";
      }
    }
  });
}

scoreHistory = loadScoreHistory();
purgeInactiveAccounts();
// Migrate any existing V6 scores into the new permanent top-3 databases
// before the daily reset can clear the short-term score list.
updateTop3Forever();
updatePerUserTop3Forever();
initializeTotalPointsFromKnownScores();

// If the active user was just purged, log them out automatically.
if (activeUserName && !userAccounts[getUserKey(activeUserName)]) {
  activeUserName = "Chubdoo";
  playerName = "Chubdoo";
  localStorage.setItem(ACTIVE_USER_KEY, activeUserName);
}

maybeResetScoresNightly();
saveCurrentUserScoreFile();
renderScoreHistory();
renderAuthStatus();
renderMissingAssetWarning();
applyPauseButtonSidePreference();
applyNoBackgroundPhotoPreference();
applyCurrentPlayerSprite();
chooseRandomSprite();
updateStartButtonLabel();
updateHudVisibility();
pendingCloudScoreQueue = loadPendingCloudScoreQueue();
loadCloudScores().then(() => retryPendingCloudScores());
subscribeToCloudScores();
setInterval(() => {
  if (isActiveRoundInProgress()) {
    cloudRefreshPendingAfterRound = true;
    return;
  }
  loadCloudScores().then(() => retryPendingCloudScores());
}, 30000);
