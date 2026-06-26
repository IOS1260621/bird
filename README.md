# Bird

Mobile-friendly Flappy Bird style game built with plain HTML, CSS, and JavaScript.

## Features

- iPhone-optimized canvas rendering (dynamic viewport + retina scaling)
- Start flow with player name input and Start Game button
- Dog player sprite using a bundled generic image ([dog.svg](dog.svg))
- Progressive difficulty with tuned mobile-friendly pacing
- Persistent per-player score history with date/time
- Game Over overlay showing current score, played timestamp, and prior scores

## Run Locally

From the project folder:

```bash
python3 -m http.server 8000
```

Open:

- http://localhost:8000

## Play Flow

1. Enter player name.
2. Press Start Game.
3. Tap/click/space to flap.
4. On Game Over, review score + timestamp + previous scores.
5. Press Play Again to start a new run.

## Data Storage

Scores and player name are stored in browser local storage.

- Key: `inventorpath_player_name`
- Key: `inventorpath_player_name_set`
- Key: `inventorpath_score_history`

To reset saved history, clear site data/local storage in your browser.

## Publish

This is a static app and can be hosted on GitHub Pages, Netlify, or Vercel.

For GitHub Pages:

1. Push to `main`.
2. In repository Settings, open Pages.
3. Deploy from branch: `main`, folder: `/ (root)`.
4. Save and wait for deployment.
