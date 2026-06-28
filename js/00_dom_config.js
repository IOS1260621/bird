
// Temporary no-op so setup code can safely call draw() before the real
// draw() function is loaded from js/09_update_loop.js.
function draw() {}

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const hudPanel = document.getElementById("hudPanel");
const hundredPhotoModal = document.getElementById("hundredPhotoModal");
const hundredPhotoTitle = document.getElementById("hundredPhotoTitle");
const hundredPhotoText = document.getElementById("hundredPhotoText");
const hundredPhotoPickButton = document.getElementById("hundredPhotoPickButton");
const hundredPhotoStartButton = document.getElementById("hundredPhotoStartButton");
const hundredPhotoContinueButton = document.getElementById("hundredPhotoContinueButton");
const hundredImageUploadInput = document.getElementById("hundredImageUploadInput");
const gameOverActions = document.getElementById("gameOverActions");
const gameOverLogoutButton = document.getElementById("gameOverLogoutButton");
const gameOverPlayAgainButton = document.getElementById("gameOverPlayAgainButton");
const spritePickerRow = document.getElementById("spritePickerRow");
const spritePicker = document.getElementById("spritePicker");
const spriteHint = document.getElementById("spriteHint");
const scoreList = document.getElementById("scoreList");
const scoreListTitle = document.getElementById("scoreListTitle");
const startGameButton = document.getElementById("startGameButton");
const imageUploadInput = document.getElementById("imageUploadInput");
const noBackgroundPhotoCheckbox = document.getElementById("noBackgroundPhotoCheckbox");
const imageUploadName = document.getElementById("imageUploadName");
const todayScoresButton = document.getElementById("todayScoresButton");
const todayScoresModal = document.getElementById("todayScoresModal");
const todayScoresContent = document.getElementById("todayScoresContent");
const todayScoresSubtitle = document.getElementById("todayScoresSubtitle");
const todayScoresRefreshButton = document.getElementById("todayScoresRefreshButton");
const todayScoresCloseButton = document.getElementById("todayScoresCloseButton");
const devUsernameInput = document.getElementById("devUsernameInput");
const devPasswordInput = document.getElementById("devPasswordInput");
const devUnlockButton = document.getElementById("devUnlockButton");
const devModeStatus = document.getElementById("devModeStatus");
const devControls = document.getElementById("devControls");
const devGameSpeedInput = document.getElementById("devGameSpeedInput");
const devBruceSizeInput = document.getElementById("devBruceSizeInput");
const devGapWidthInput = document.getElementById("devGapWidthInput");
const devGapHeightInput = document.getElementById("devGapHeightInput");
const devGodModeCheckbox = document.getElementById("devGodModeCheckbox");
const devResetButton = document.getElementById("devResetButton");
const devExitButton = document.getElementById("devExitButton");
const pauseRightCheckbox = document.getElementById("pauseRightCheckbox");
const chooseChubsonButton = document.getElementById("chooseChubsonButton");
const chooseChubdooButton = document.getElementById("chooseChubdooButton");
const selectedSpritePreview = document.getElementById("selectedSpritePreview");
const selectedSpritePreviewImage = document.getElementById("selectedSpritePreviewImage");
const selectedSpriteLabel = document.getElementById("selectedSpriteLabel");
const randomSpriteButton = document.getElementById("randomSpriteButton");
const resetSpriteButton = document.getElementById("resetSpriteButton");
const startStatusMessage = document.getElementById("startStatusMessage");
const assetWarning = document.getElementById("assetWarning");
const pauseGameButton = document.getElementById("pauseGameButton");
const ctGantryImage = new Image();

const DEFAULT_DOG_SPRITE = "dog.svg";
const AVAILABLE_DOG_SPRITES = ["dog.svg", "bruce.png", "gooboybruce.PNG", "smileB.png"];
const PNG_DOG_SPRITES = AVAILABLE_DOG_SPRITES.filter(spriteName => spriteName.toLowerCase().endsWith(".png"));
const SUPABASE_PROJECT_URL = "https://tvqofzoyyxqbuqgobxvj.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_jC03NY9MNhki9pX9Wmd-TA_GJzmvGxO";
const SUPABASE_ENABLED = Boolean(
  SUPABASE_PROJECT_URL &&
  SUPABASE_PUBLISHABLE_KEY &&
  window.supabase &&
  typeof window.supabase.createClient === "function"
);
const supabaseClient = SUPABASE_ENABLED
  ? window.supabase.createClient(SUPABASE_PROJECT_URL, SUPABASE_PUBLISHABLE_KEY)
  : null;


// ── Game settings ───────────────────────────────────────────────────────────
const GAME_CONFIG = {
  dataVersion: 38,
  maxScoreHistoryEntries: 100,
  firstMysteryScore: 5,
  repeatMysteryStartScore: 10,
  repeatMysteryInterval: 5,
  godModeDurationMs: 2000,
  imagePickGodModeDurationMs: 3000,
  regularEffectDurationMs: 15000,
  slowEffectDurationMs: 5000,
  collisionRadiusMultiplier: 0.82,
  playerBaseSizeMin: 20,
  playerBaseSizeMax: 26,
  playerBaseSizeWidthRatio: 0.032,
  gravityBase: 0.4,
  gravityHeightDivisor: 5000,
  gravityMin: 0.42,
  gravityMax: 0.56,
  jumpBase: 7.6,
  jumpHeightDivisor: 980,
  jumpMin: 7.8,
  jumpMax: 8.9,
  pipeWidth: 68.4,
  pipeSpeedBase: 2.7,
  pipeSpeedDifficultyStep: 0.03,
  pipeSpeedGlobalMultiplier: 0.7,
  pipeScoreSpeedStep: 1.02,
  pipeScoreSpeedEvery: 25,
  pipeSpawnSpacingBase: 280,
  pipeSpawnSpacingDifficultyStep: 2,
  pipeSpawnSpacingMin: 200,
  pipeGapHeightRatio: 0.288,
  pipeGapMin: 158,
  pipeGapMax: 228,
  pipeGapFloor: 142,
  pipeGapScale: 1.518,
  pipeGapOverallMultiplier: 1.012,
  pipeGapScore50Factor: 0.96,
  pipeGapEvery50Factor: 0.95,
  mysteryEffectWeights: [
    { type: "tiny", label: "Tiny", weight: 24 },
    { type: "large", label: "Large", weight: 24 },
    { type: "slow", label: "Slow", weight: 24 },
    { type: "fast", label: "Fast", weight: 24 },
    { type: "god", label: "God Mode", weight: 4 }
  ]
};


// V13: preload all player sprites once and switch by name.
// This prevents iPhone/GitHub Pages timing/caching issues where the selector
// changed but the displayed Bruce image did not update reliably.
const spriteImages = {};
let currentSprite = DEFAULT_DOG_SPRITE;
let missingAssetNames = [];

AVAILABLE_DOG_SPRITES.forEach(spriteName => {
  const img = new Image();
  img.onload = () => {
    // Redraw immediately after a sprite finishes loading.
    draw();
  };
  img.onerror = () => {
    console.warn("Missing or failed sprite image:", spriteName);
    recordMissingAsset(spriteName);
  };
  img.src = spriteName;
  spriteImages[spriteName] = img;
});

ctGantryImage.onerror = () => recordMissingAsset("ct-gantry.svg");
ctGantryImage.src = "ct-gantry.svg";

const SCORE_HISTORY_KEY = "inventorpath_score_history";
const SPRITE_CHOICES_KEY = "inventorpath_sprite_choices";
const USER_ACCOUNTS_KEY = "inventorpath_user_accounts";
const ACTIVE_USER_KEY = "inventorpath_active_user";
const SCORE_FILE_PREFIX = "inventorpath_score_file_";
const TOP3_FOREVER_KEY = "inventorpath_top3_forever";
const PER_USER_TOP3_FOREVER_KEY = "inventorpath_per_user_top3_forever";
const DAILY_STATS_KEY = "inventorpath_daily_stats";
const TOTAL_POINTS_BY_USER_KEY = "inventorpath_total_points_by_user";
const TOTAL_POINTS_DATE_KEY = "inventorpath_total_points_date";
const PAUSE_BUTTON_RIGHT_KEY = "inventorpath_pause_button_right";
const NO_BACKGROUND_PHOTO_KEY = "inventorpath_no_background_photo";
const DEV_SETTINGS_KEY = "inventorpath_dev_settings";
const DEV_MODE_UNLOCKED_KEY = "inventorpath_dev_mode_unlocked";
const LAST_RESET_DATE_KEY = "inventorpath_last_reset_date";
const DATA_VERSION_KEY = "inventorpath_data_version";
const INACTIVITY_DAYS = 14;
const MS_PER_DAY = 86400000;


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

let gameWidth = 0;
let gameHeight = 0;
let uiScale = 1;

let pipes = [];
let score = 0;
let gameStarted = false;
let gameOver = false;
let gamePaused = false;
let scoreSavedForRound = false;
let lastSavedEntry = null;
let totalPipesCreated = 0;
let mysteryBox = null;
let firstMysteryQueued = false;
let nextMysteryScoreThreshold = GAME_CONFIG.firstMysteryScore;
let activeEffects = {
  size: null,
  speed: null
};
let speedMultiplier = 1;
let sizeMultiplier = 1;
let invincibleUntil = 0;
let godModeCharges = 0;
let lastRoundEffectLabel = "None";
let deathEffectLabel = "None";
let revealImage = new Image();
let revealImageReady = false;
let revealImageName = "";
let revealImageObjectUrl = "";
let revealCellOrder = [];
let backgroundSwapPending = false;
let pendingHundredScore = 0;
let nextPhotoMilestoneScore = 100;
let hundredPhotoReadyToStart = false;
let keepCurrentPhotoFullyRevealed = false;
let cloudScoresLoaded = false;
let cloudScoresLastLoadedAt = 0;
let cloudScoresSaveError = "";
let cloudDailyLeaderKey = "";
let cloudRealtimeChannel = null;
let cloudDailyTotals = createEmptyCloudDailyTotals();
let cloudLifetimeTotals = createEmptyCloudLifetimeTotals();
let cloudTodayScores = [];
let cloudTopScores = [];
let cloudLastSaveStatus = "Cloud save: not tested yet";
let cloudLastLoadStatus = "Cloud load: not loaded yet";
let cloudLastSavedScoreText = "";
let cloudLastErrorDetail = "";
let pendingCloudScoreQueue = [];
let cloudRefreshPendingAfterRound = false;
let lastPipeGapY = Number.NaN;
let currentAttemptNumber = 0;
let currentRoundTopScorerBonusGranted = false;
let currentRoundIsDevMode = false;
let currentRoundDevSettingsSnapshot = null;
let activeGapPattern = null;
let activeGapPatternStepIndex = 0;
let forceRecoveryPipe = false;
let currentGapPatternName = "Random Drift";
let currentGapPatternDifficulty = 0;
let lastGapPatternName = "None";
let lastGapPatternDifficulty = 0;
const PENDING_CLOUD_SCORE_QUEUE_KEY = "inventorpath_pending_cloud_score_queue";
const GAME_ATTEMPT_COUNT_KEY = "inventorpath_game_attempt_count";
const PIPE_SETTINGS_VERSION = "difficulty_engine_v9_dev_admin_controls";


function sanitizeName(name) {
  const trimmed = name.trim().replace(/\s+/g, " ");
  return trimmed.slice(0, 20);
}

function sanitizeUsername(name) {
  return sanitizeName(name).replace(/[^a-zA-Z0-9 _.-]/g, "");
}

function getUserKey(name) {
  return sanitizeUsername(name).toLowerCase();
}

const FIXED_LOGIN_PASSWORD = "password";
const FIXED_USER_ACCOUNTS = {
  chubdoo: {
    userName: "Chubdoo",
    password: FIXED_LOGIN_PASSWORD,
    createdAt: "fixed-account",
    lastActivity: "fixed-account"
  },
  chubson: {
    userName: "Chubson",
    password: FIXED_LOGIN_PASSWORD,
    createdAt: "fixed-account",
    lastActivity: "fixed-account"
  }
};

function isFixedUserKey(userKey) {
  return Object.prototype.hasOwnProperty.call(FIXED_USER_ACCOUNTS, String(userKey || "").toLowerCase());
}

function isAllowedPlayerName(name) {
  return isFixedUserKey(getUserKey(name));
}

function getFixedUserAccounts() {
  return JSON.parse(JSON.stringify(FIXED_USER_ACCOUNTS));
}
