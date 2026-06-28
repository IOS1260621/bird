alter table public.game_scores
  add column if not exists gap_pattern_at_death text,
  add column if not exists pattern_difficulty_at_death integer;
