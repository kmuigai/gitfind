// Early Signal Score — GitFind's proprietary algorithm
// DO NOT change these weights without asking the product owner first.
//
// Weights (must sum to 100%):
// Star velocity (7-day):              30%
// Contributor-to-star ratio:          25%
// Fork velocity relative to stars:    15%
// Cross-platform mention velocity:    15%
// Commit frequency (30-day):          10%
// Manipulation filter:                Penalty

export interface ScoreInputs {
  // Star signals
  stars: number
  stars_7d: number      // New stars in last 7 days
  stars_30d: number     // New stars in last 30 days

  // Contributor signal
  contributors: number

  // Fork signal
  forks: number

  // Cross-platform mentions (HN + Reddit + X — Reddit/X deferred post-launch)
  hn_mentions_7d: number
  hn_mentions_30d: number

  // Commit frequency
  commits_30d: number
}

export interface ScoreBreakdown {
  star_velocity_score: number       // 0–100, weighted 30%
  contributor_ratio_score: number   // 0–100, weighted 25%
  fork_velocity_score: number       // 0–100, weighted 15%
  mention_velocity_score: number    // 0–100, weighted 15%
  commit_frequency_score: number    // 0–100, weighted 10%
  manipulation_penalty: number      // 0–30, subtracted from total
  raw_score: number                 // Before penalty (0–100)
  final_score: number               // After penalty, clamped 0–100
}

export interface ScoreResult {
  score: number
  breakdown: ScoreBreakdown
}

// Normalise a raw value to 0–100 using a logarithmic scale
// Good for values that grow exponentially (stars, mentions)
function logNormalise(value: number, scale: number): number {
  if (value <= 0) return 0
  const normalised = (Math.log(value + 1) / Math.log(scale + 1)) * 100
  return Math.min(100, Math.max(0, normalised))
}

// Linear normalise: value / max * 100, clamped to 0–100
function linearNormalise(value: number, max: number): number {
  if (max <= 0) return 0
  return Math.min(100, Math.max(0, (value / max) * 100))
}

// --- Individual signal calculators ---

// Star velocity: how many new stars in the last 7 days?
// A score of 100 = 1,000+ new stars in 7 days
function calcStarVelocity(stars_7d: number): number {
  return logNormalise(stars_7d, 1000)
}

// Contributor-to-star ratio: high ratio = builders before fans
// A healthy ratio is 1 contributor per 5–20 stars for early repos
// Scale: 0.2 contributors/star = 100 (very early, builder-heavy)
function calcContributorRatio(contributors: number, stars: number): number {
  if (stars <= 0) return 0
  const ratio = contributors / stars
  // Ratio of 0.05 (1 contributor per 20 stars) = 50 score
  // Ratio of 0.2 (1 contributor per 5 stars) = 100 score
  return linearNormalise(ratio, 0.2)
}

// Fork velocity relative to stars: people building on top before starring
// Healthy fork-to-star ratio for a rising project: 15–40%
// Scale: 0.4 fork/star ratio = 100
function calcForkVelocity(forks: number, stars: number): number {
  if (stars <= 0) return 0
  const ratio = forks / stars
  return linearNormalise(ratio, 0.4)
}

// Cross-platform mention velocity: HN chatter before mainstream press
// Scale: 20 mentions in 7 days = 100 score
function calcMentionVelocity(hn_mentions_7d: number, hn_mentions_30d: number): number {
  // Weight recent mentions (7-day) more than 30-day
  const weighted = hn_mentions_7d * 2 + hn_mentions_30d * 0.5
  return logNormalise(weighted, 50)
}

// Commit frequency: active maintenance signal
// Scale: 50 commits in 30 days = 100 score (very active)
function calcCommitFrequency(commits_30d: number): number {
  return logNormalise(commits_30d, 50)
}

// Manipulation filter: penalise star farming
// Signs of manipulation:
// 1. Many new stars but very few commits (stars not earned by activity)
// 2. Star-to-contributor ratio is extremely low (fans only, no builders)
// Returns 0–30 penalty points subtracted from final score
function calcManipulationPenalty(inputs: ScoreInputs): number {
  const { stars, stars_7d, commits_30d, contributors } = inputs
  let penalty = 0

  // Sudden star spike with near-zero commit activity
  if (stars_7d > 500 && commits_30d < 5) {
    penalty += 20
  } else if (stars_7d > 200 && commits_30d < 2) {
    penalty += 15
  } else if (stars_7d > 100 && commits_30d === 0) {
    penalty += 10
  }

  // Very few contributors relative to stars (fan project, not builder project)
  if (stars > 1000 && contributors < 2) {
    penalty += 10
  } else if (stars > 500 && contributors < 2) {
    penalty += 5
  }

  return Math.min(30, penalty)
}

export function calculateScore(inputs: ScoreInputs): ScoreResult {
  const star_velocity_score = calcStarVelocity(inputs.stars_7d)
  const contributor_ratio_score = calcContributorRatio(inputs.contributors, inputs.stars)
  const fork_velocity_score = calcForkVelocity(inputs.forks, inputs.stars)
  const mention_velocity_score = calcMentionVelocity(inputs.hn_mentions_7d, inputs.hn_mentions_30d)
  const commit_frequency_score = calcCommitFrequency(inputs.commits_30d)

  // Weighted sum — weights must total 100%
  const raw_score =
    star_velocity_score * 0.30 +
    contributor_ratio_score * 0.25 +
    fork_velocity_score * 0.15 +
    mention_velocity_score * 0.15 +
    commit_frequency_score * 0.10

  const manipulation_penalty = calcManipulationPenalty(inputs)
  const final_score = Math.round(Math.min(100, Math.max(0, raw_score - manipulation_penalty)))

  return {
    score: final_score,
    breakdown: {
      star_velocity_score: Math.round(star_velocity_score),
      contributor_ratio_score: Math.round(contributor_ratio_score),
      fork_velocity_score: Math.round(fork_velocity_score),
      mention_velocity_score: Math.round(mention_velocity_score),
      commit_frequency_score: Math.round(commit_frequency_score),
      manipulation_penalty,
      raw_score: Math.round(raw_score),
      final_score,
    },
  }
}
