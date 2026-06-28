// ── Uploaded photo reveal puzzle ───────────────────────────────────────────
function shuffleRevealCells() {
  revealCellOrder = Array.from({ length: 100 }, (_, index) => index);
  for (let i = revealCellOrder.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = revealCellOrder[i];
    revealCellOrder[i] = revealCellOrder[j];
    revealCellOrder[j] = temp;
  }
}

function resetImageRevealPuzzle() {
  if (revealImageReady) {
    shuffleRevealCells();
  } else {
    revealCellOrder = [];
  }
}

function clearRevealImageSelection() {
  if (revealImageObjectUrl) {
    URL.revokeObjectURL(revealImageObjectUrl);
  }
  revealImage = new Image();
  revealImageReady = false;
  revealImageName = "";
  revealImageObjectUrl = "";
  revealCellOrder = [];
  keepCurrentPhotoFullyRevealed = false;
  if (imageUploadName) {
    imageUploadName.style.display = "none";
    imageUploadName.textContent = "";
  }
  updateStartButtonState();
  draw();
}

function loadRevealImageFile(file, afterLoad) {
  if (!file) {
    return;
  }

  const previousImage = revealImage;
  const previousReady = revealImageReady;
  const previousName = revealImageName;
  const previousObjectUrl = revealImageObjectUrl;
  const nextObjectUrl = URL.createObjectURL(file);
  const nextImage = new Image();
  const nextName = file.name || "img-1";

  nextImage.onload = () => {
    if (previousObjectUrl && previousObjectUrl !== nextObjectUrl) {
      URL.revokeObjectURL(previousObjectUrl);
    }

    revealImage = nextImage;
    revealImageObjectUrl = nextObjectUrl;
    revealImageName = nextName;
    revealImageReady = true;
    keepCurrentPhotoFullyRevealed = false;
    resetImageRevealPuzzle();

    if (imageUploadName) {
      imageUploadName.style.display = "block";
      imageUploadName.textContent = "Photo loaded: " + revealImageName;
    }

    updateStartButtonState();

    if (typeof afterLoad === "function") {
      afterLoad();
    } else {
      draw();
    }
  };

  nextImage.onerror = () => {
    URL.revokeObjectURL(nextObjectUrl);
    revealImage = previousImage;
    revealImageReady = previousReady;
    revealImageName = previousName;
    revealImageObjectUrl = previousObjectUrl;

    if (imageUploadName) {
      imageUploadName.style.display = "block";
      imageUploadName.textContent = previousReady
        ? "Could not load new photo. Keeping current photo."
        : "Could not load photo. Pick a different image.";
    }

    alert(previousReady ? "Could not load new photo. Keeping current photo." : "Could not load photo. Pick a different image.");
    updateStartButtonState();
    draw();
  };

  nextImage.src = nextObjectUrl;
}

function handleImageUpload(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) {
    clearRevealImageSelection();
    if (noBackgroundPhotoCheckbox) {
      noBackgroundPhotoCheckbox.checked = true;
      saveNoBackgroundPhotoPreference();
    }
    return;
  }
  if (noBackgroundPhotoCheckbox) {
    noBackgroundPhotoCheckbox.checked = false;
    saveNoBackgroundPhotoPreference();
  }
  loadRevealImageFile(file);
}

function handleHundredImageUpload(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) {
    return;
  }
  loadRevealImageFile(file, prepareHundredPhotoStartAfterImageChoice);
  if (hundredImageUploadInput) {
    hundredImageUploadInput.value = "";
  }
}

function getImageRevealCount() {
  if (keepCurrentPhotoFullyRevealed) {
    return 100;
  }

  if (backgroundSwapPending && pendingHundredScore > 0) {
    return hundredPhotoReadyToStart ? 0 : 100;
  }
  return clamp(Math.floor(score % 100), 0, 100);
}

function drawImageRevealPuzzle(panelX, panelY, panelSize) {
  if (!revealImageReady || !revealImage.complete || revealImage.naturalWidth <= 0) {
    return;
  }

  const revealedCount = getImageRevealCount();
  const padding = Math.round(clamp(8 * uiScale, 6, 12));
  const labelHeight = Math.round(clamp(24 * uiScale, 20, 30));
  const imageSize = panelSize - padding * 2;
  const imageX = panelX + padding;
  const imageY = panelY + labelHeight + padding;
  const cardHeight = imageSize + labelHeight + padding * 2;

  ctx.save();
  ctx.fillStyle = "rgba(15,23,42,0.68)";
  ctx.fillRect(panelX, panelY, panelSize, cardHeight);
  ctx.strokeStyle = "rgba(255,255,255,0.48)";
  ctx.lineWidth = 1;
  ctx.strokeRect(panelX, panelY, panelSize, cardHeight);

  ctx.fillStyle = "#f8fafc";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "900 " + Math.round(clamp(12 * uiScale, 10, 15)) + "px Arial";
  ctx.fillText("photo reveal " + revealedCount + "/100", panelX + panelSize / 2, panelY + labelHeight / 2);

  ctx.fillStyle = "rgba(2, 6, 23, 0.92)";
  ctx.fillRect(imageX, imageY, imageSize, imageSize);

  const sourceCellW = revealImage.naturalWidth / 10;
  const sourceCellH = revealImage.naturalHeight / 10;
  const destCell = imageSize / 10;

  for (let i = 0; i < revealedCount && i < revealCellOrder.length; i += 1) {
    const cellIndex = revealCellOrder[i];
    const col = cellIndex % 10;
    const row = Math.floor(cellIndex / 10);
    ctx.drawImage(
      revealImage,
      col * sourceCellW,
      row * sourceCellH,
      sourceCellW,
      sourceCellH,
      imageX + col * destCell,
      imageY + row * destCell,
      destCell + 0.5,
      destCell + 0.5
    );
  }

  ctx.strokeStyle = "rgba(255,255,255,0.22)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 10; i += 1) {
    const line = imageX + i * destCell;
    ctx.beginPath();
    ctx.moveTo(line, imageY);
    ctx.lineTo(line, imageY + imageSize);
    ctx.stroke();

    const rowLine = imageY + i * destCell;
    ctx.beginPath();
    ctx.moveTo(imageX, rowLine);
    ctx.lineTo(imageX + imageSize, rowLine);
    ctx.stroke();
  }

  ctx.restore();
}

function drawActiveImageRevealPuzzle() {
  if (!shouldUseBackgroundPhoto() || gameOver) {
    return;
  }
  const panelSize = Math.round(clamp(Math.min(gameWidth * 0.28, gameHeight * 0.22), 104, 172));
  const panelX = gameWidth - panelSize - Math.round(clamp(12 * uiScale, 10, 18));
  const panelY = Math.round(clamp(78 * uiScale, 66, 96));
  drawImageRevealPuzzle(panelX, panelY, panelSize);
}

function drawSkyBackground() {
  const gradient = ctx.createLinearGradient(0, 0, 0, gameHeight);
  gradient.addColorStop(0, "#70c5ce");
  gradient.addColorStop(1, "#ffffff");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, gameWidth, gameHeight);
}

function getRevealImageCoverRect() {
  const imageRatio = revealImage.naturalWidth / revealImage.naturalHeight;
  const canvasRatio = gameWidth / gameHeight;
  let sx = 0;
  let sy = 0;
  let sw = revealImage.naturalWidth;
  let sh = revealImage.naturalHeight;

  if (imageRatio > canvasRatio) {
    sw = revealImage.naturalHeight * canvasRatio;
    sx = (revealImage.naturalWidth - sw) / 2;
  } else {
    sh = revealImage.naturalWidth / canvasRatio;
    sy = (revealImage.naturalHeight - sh) / 2;
  }

  return { sx, sy, sw, sh };
}

function drawRevealedPhotoBackground() {
  if (!shouldUseBackgroundPhoto() || !revealImage.complete || revealImage.naturalWidth <= 0) {
    return;
  }

  const revealedCount = getImageRevealCount();
  if (revealedCount <= 0) {
    return;
  }

  const cover = getRevealImageCoverRect();
  const destCellW = gameWidth / 10;
  const destCellH = gameHeight / 10;
  const sourceCellW = cover.sw / 10;
  const sourceCellH = cover.sh / 10;

  ctx.save();
  for (let i = 0; i < revealedCount && i < revealCellOrder.length; i += 1) {
    const cellIndex = revealCellOrder[i];
    const col = cellIndex % 10;
    const row = Math.floor(cellIndex / 10);

    ctx.drawImage(
      revealImage,
      cover.sx + col * sourceCellW,
      cover.sy + row * sourceCellH,
      sourceCellW,
      sourceCellH,
      col * destCellW,
      row * destCellH,
      destCellW + 0.75,
      destCellH + 0.75
    );
  }
  ctx.restore();
}

function drawGameBackground() {
  drawSkyBackground();
  drawRevealedPhotoBackground();
}


function showHundredPhotoPrompt() {
  hundredPhotoReadyToStart = false;
  if (hundredPhotoTitle) {
    hundredPhotoTitle.textContent = pendingHundredScore + " points!";
  }
  if (hundredPhotoText) {
    hundredPhotoText.textContent = "Pick a new picture to reveal in the background. After it loads, press Start Game to continue.";
  }
  if (hundredPhotoPickButton) {
    hundredPhotoPickButton.style.display = "block";
  }
  if (hundredPhotoContinueButton) {
    hundredPhotoContinueButton.style.display = "block";
  }
  if (hundredPhotoStartButton) {
    hundredPhotoStartButton.style.display = "none";
  }
  if (hundredPhotoModal) {
    hundredPhotoModal.style.display = "flex";
  }
  updatePauseButtonVisibility();
  draw();
}

function hideHundredPhotoPrompt() {
  if (hundredPhotoModal) {
    hundredPhotoModal.style.display = "none";
  }
}

function promptForNewPhotoAtHundred(pipe) {
  // Trigger at every 100-point milestone. Use >= instead of === so the
  // prompt cannot be missed if more than one pipe is passed in a fast frame.
  if (isNoBackgroundPhotoEnabled() || !revealImageReady) {
    return;
  }
  if (backgroundSwapPending || score <= 0 || score < nextPhotoMilestoneScore) {
    return;
  }

  pendingHundredScore = nextPhotoMilestoneScore;
  while (nextPhotoMilestoneScore <= score) {
    nextPhotoMilestoneScore += 100;
  }
  backgroundSwapPending = true;
  gamePaused = true;
  bird.velocity = 0;
  showHundredPhotoPrompt();
}

function placeBruceAtCenterForImageReveal() {
  bird.x = clamp(gameWidth / 2, bird.size + 4, gameWidth - bird.size - 4);
  bird.y = clamp(gameHeight / 2, bird.size + 4, gameHeight - bird.size - 4);
  bird.velocity = 0;
}

function activateImagePickGodMode() {
  invincibleUntil = Date.now() + GAME_CONFIG.imagePickGodModeDurationMs;
  rememberRoundEffect("God Mode");
}

function restorePlayerAtHundredPosition() {
  // New reveal image starts Bruce in the center for a clean restart.
  placeBruceAtCenterForImageReveal();
}

function prepareHundredPhotoStartAfterImageChoice() {
  if (!backgroundSwapPending || !revealImageReady) {
    return;
  }

  hundredPhotoReadyToStart = true;
  keepCurrentPhotoFullyRevealed = false;
  gamePaused = true;
  bird.velocity = 0;
  placeBruceAtCenterForImageReveal();

  if (hundredPhotoTitle) {
    hundredPhotoTitle.textContent = "New picture loaded";
  }
  if (hundredPhotoText) {
    hundredPhotoText.textContent = "Press Start Game to continue. Bruce will restart in the center and receive 3 seconds of God Mode.";
  }
  if (hundredPhotoPickButton) {
    hundredPhotoPickButton.style.display = "none";
  }
  if (hundredPhotoContinueButton) {
    hundredPhotoContinueButton.style.display = "none";
  }
  if (hundredPhotoStartButton) {
    hundredPhotoStartButton.style.display = "block";
  }

  updatePauseButtonVisibility();
  draw();
}

function continueWithSamePictureAfterHundred() {
  if (!backgroundSwapPending || !revealImageReady) {
    return;
  }
  hundredPhotoReadyToStart = false;
  keepCurrentPhotoFullyRevealed = true;
  resumeAfterHundredPhotoChange({ resetReveal: false });
}

function resumeAfterHundredPhotoChange(options) {
  const settings = options || {};
  const shouldResetReveal = settings.resetReveal !== false;

  hundredPhotoReadyToStart = false;
  backgroundSwapPending = false;
  pendingHundredScore = 0;
  hideHundredPhotoPrompt();
  if (shouldResetReveal) {
    keepCurrentPhotoFullyRevealed = false;
    resetImageRevealPuzzle();
  }
  restorePlayerAtHundredPosition();
  activateImagePickGodMode();
  gamePaused = false;
  updatePauseButtonVisibility();
  draw();
}
