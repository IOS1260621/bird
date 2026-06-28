// ── Developer / Admin controls ─────────────────────────────────────────────
const DEFAULT_DEV_SETTINGS = {
  gameSpeed: 0,
  bruceSize: 0,
  gapWidth: 0,
  gapHeight: 0,
  gm: false
};

function safeJsonParse(text, fallback) {
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

function clampPercentValue(value) {
  const n = Math.round(Number(value) || 0);
  return Math.max(-90, Math.min(300, n));
}

function normalizeDevSettings(settings) {
  const raw = settings && typeof settings === "object" ? settings : {};
  return {
    gameSpeed: clampPercentValue(raw.gameSpeed),
    bruceSize: clampPercentValue(raw.bruceSize),
    gapWidth: clampPercentValue(raw.gapWidth),
    gapHeight: clampPercentValue(raw.gapHeight),
    gm: Boolean(raw.gm)
  };
}

function loadDevSettings() {
  const raw = localStorage.getItem(DEV_SETTINGS_KEY);
  return normalizeDevSettings(raw ? safeJsonParse(raw, DEFAULT_DEV_SETTINGS) : DEFAULT_DEV_SETTINGS);
}

function saveDevSettings(settings) {
  const clean = normalizeDevSettings(settings);
  localStorage.setItem(DEV_SETTINGS_KEY, JSON.stringify(clean));
  return clean;
}

let devSettings = loadDevSettings();
let devModeUnlocked = readDevModeUnlocked();

function readDevModeUnlocked() {
  try {
    if (window.sessionStorage && window.sessionStorage.getItem(DEV_MODE_UNLOCKED_KEY) === "true") {
      return true;
    }
  } catch {
    // Ignore storage restrictions.
  }
  return false;
}

function setDevModeUnlocked(value) {
  devModeUnlocked = Boolean(value);
  try {
    if (window.sessionStorage) {
      if (devModeUnlocked) {
        window.sessionStorage.setItem(DEV_MODE_UNLOCKED_KEY, "true");
      } else {
        window.sessionStorage.removeItem(DEV_MODE_UNLOCKED_KEY);
      }
    }
  } catch {
    // Ignore storage restrictions.
  }
  renderDevSettingsUi();
}

function percentToMultiplier(value) {
  return Math.max(0.1, 1 + (clampPercentValue(value) / 100));
}

function getCurrentDevSettings() {
  return normalizeDevSettings(devSettings);
}

function isDeveloperModeActive() {
  return Boolean(devModeUnlocked);
}

function isRoundDevMode() {
  return Boolean(currentRoundIsDevMode);
}

function isDeveloperGodModeEnabled() {
  return isDeveloperModeActive() && Boolean(devSettings.gm);
}

function isDeveloperGodModeEnabledForRound() {
  return Boolean(currentRoundIsDevMode && currentRoundDevSettingsSnapshot && currentRoundDevSettingsSnapshot.gm);
}

function getEffectiveGameSpeedMultiplier() {
  if (!isDeveloperModeActive()) return 1;
  return percentToMultiplier(devSettings.gameSpeed);
}

function getEffectiveBruceSizeMultiplier() {
  if (!isDeveloperModeActive()) return 1;
  return percentToMultiplier(devSettings.bruceSize);
}

function getEffectiveGapWidthMultiplier() {
  if (!isDeveloperModeActive()) return 1;
  return percentToMultiplier(devSettings.gapWidth);
}

function getEffectiveGapHeightMultiplier() {
  if (!isDeveloperModeActive()) return 1;
  return percentToMultiplier(devSettings.gapHeight);
}

function getEffectivePipeWidth() {
  return Math.max(16, (GAME_CONFIG.pipeWidth || 68.4) * getEffectiveGapWidthMultiplier());
}

function applyDeveloperDifficultySettings(difficulty) {
  const d = { ...difficulty };
  if (isDeveloperModeActive()) {
    d.gapSize = Math.max(70, d.gapSize * getEffectiveGapHeightMultiplier());
  }
  return d;
}

function getDevModeScoreStatusText() {
  if (!isDeveloperModeActive()) {
    return "Developer Mode locked.";
  }
  return "DEV MODE ON — scores will not be saved.";
}

function updateDevSettingsFromInputs() {
  devSettings = saveDevSettings({
    gameSpeed: devGameSpeedInput ? devGameSpeedInput.value : devSettings.gameSpeed,
    bruceSize: devBruceSizeInput ? devBruceSizeInput.value : devSettings.bruceSize,
    gapWidth: devGapWidthInput ? devGapWidthInput.value : devSettings.gapWidth,
    gapHeight: devGapHeightInput ? devGapHeightInput.value : devSettings.gapHeight,
    gm: devGodModeCheckbox ? devGodModeCheckbox.checked : devSettings.gm
  });
  recalculateBirdSize();
  updateStartButtonState();
  renderDevSettingsUi();
  draw();
}

function renderDevSettingsUi() {
  if (devGameSpeedInput) devGameSpeedInput.value = String(devSettings.gameSpeed);
  if (devBruceSizeInput) devBruceSizeInput.value = String(devSettings.bruceSize);
  if (devGapWidthInput) devGapWidthInput.value = String(devSettings.gapWidth);
  if (devGapHeightInput) devGapHeightInput.value = String(devSettings.gapHeight);
  if (devGodModeCheckbox) devGodModeCheckbox.checked = Boolean(devSettings.gm);
  if (devControls) devControls.style.display = isDeveloperModeActive() ? "block" : "none";
  if (devModeStatus) {
    devModeStatus.textContent = getDevModeScoreStatusText();
    devModeStatus.classList.toggle("dev-active", isDeveloperModeActive());
  }
}

function unlockDeveloperMode() {
  const user = String(devUsernameInput && devUsernameInput.value || "").trim();
  const pass = String(devPasswordInput && devPasswordInput.value || "").trim();

  if (user === "Admin" && pass === "Admin") {
    setDevModeUnlocked(true);
    if (devPasswordInput) devPasswordInput.value = "";
    updateStartButtonState();
    draw();
    return true;
  }

  if (devModeStatus) {
    devModeStatus.textContent = "Developer login failed.";
    devModeStatus.classList.remove("dev-active");
  }
  return false;
}

function resetDeveloperSettings() {
  devSettings = saveDevSettings(DEFAULT_DEV_SETTINGS);
  recalculateBirdSize();
  renderDevSettingsUi();
  updateStartButtonState();
  draw();
}

function exitDeveloperMode() {
  setDevModeUnlocked(false);
  recalculateBirdSize();
  updateStartButtonState();
  draw();
}

function bindDeveloperSettingsEvents() {
  if (devUnlockButton) devUnlockButton.addEventListener("click", unlockDeveloperMode);
  if (devResetButton) devResetButton.addEventListener("click", resetDeveloperSettings);
  if (devExitButton) devExitButton.addEventListener("click", exitDeveloperMode);
  [devGameSpeedInput, devBruceSizeInput, devGapWidthInput, devGapHeightInput].forEach(input => {
    if (input) input.addEventListener("change", updateDevSettingsFromInputs);
  });
  if (devGodModeCheckbox) devGodModeCheckbox.addEventListener("change", updateDevSettingsFromInputs);
  renderDevSettingsUi();
}

bindDeveloperSettingsEvents();
