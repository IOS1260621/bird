# Bouncing Bruce — Clean File Structure V42

This is the same Bouncing Bruce V42 Pattern Engine app, split into cleaner files.

## Main files

- `index.html` — page structure and script loading order
- `css/style.css` — all styling
- `js/00_dom_config.js` — DOM references, game config, globals, Supabase setup
- `js/01_storage_cloud.js` — local storage, player accounts, Supabase save/load/realtime logic
- `js/02_sprites.js` — Bruce sprite selection/randomization
- `js/03_photo_reveal.js` — optional background photo reveal and 100-point prompt
- `js/04_effects.js` — size/speed/God Mode effects
- `js/05_mystery.js` — mystery box behavior
- `js/06_scores_stats.js` — local score history, daily stats, total points battle
- `js/07_game_state_draw.js` — start/reset/game state and canvas drawing
- `js/08_sound.js` — sound effects
- `js/09_update_loop.js` — controls, update loop, collisions, pipe movement
- `sql/v42_pattern_engine_columns.sql` — optional Supabase analytics columns

## Required image assets

Keep these image files in the same folder as `index.html`, unless you update the paths in `js/00_dom_config.js`:

- `dog.svg`
- `bruce.png`
- `gooboybruce.PNG`
- `smileB.png`
- `ct-gantry.svg`

## Notes

This version uses plain `<script>` files instead of JavaScript modules so the original global game code behavior is preserved. That makes it easier to split the app without accidentally breaking it.

To deploy on GitHub Pages, upload all folders/files exactly as shown.


## V45 spacing update

Pipe spacing now uses a screen-width rule: the game targets about 2.5 visible pipe-gap sets on screen at a time. This is handled by `getTargetPipeSpacing()` in `js/02_sprites.js`, and the update loop uses that value when deciding when to spawn the next pipe.


## V45 changes

- Restored the original vertical gap opening sizes from V43.
- Reduced each vertical column width by 20%: 85.5px to 68.4px.
- Changed the screen-spacing target from 2.5 visible column/gap sets to 3.0 visible column/gap sets.
- Kept Supabase cloud scores and Pattern Engine V1.
