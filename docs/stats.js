/**
 * Head-to-head category comparison logic.
 *
 * A "category" is { key, lowerIsBetter, type }.
 * "stats" objects map category keys to numeric values for one team.
 */

export const WIN = 'win';
export const LOSS = 'loss';
export const TIE = 'tie';

/** Compares one category. Returns WIN, LOSS, TIE, or null when a value is missing. */
export function compareCategory(category, mine, theirs) {
  if (!Number.isFinite(mine) || !Number.isFinite(theirs)) {
    return null;
  }
  if (mine === theirs) {
    return TIE;
  }
  const mineIsBetter = category.lowerIsBetter ? mine < theirs : mine > theirs;
  return mineIsBetter ? WIN : LOSS;
}

/** Compares two teams over all categories from the first team's point of view. */
export function compareTeams(categories, mine, theirs) {
  const results = {};
  let wins = 0;
  let losses = 0;
  let ties = 0;

  for (const category of categories) {
    const result = compareCategory(category, mine[category.key], theirs[category.key]);
    results[category.key] = result;
    if (result === WIN) wins++;
    else if (result === LOSS) losses++;
    else if (result === TIE) ties++;
  }

  let outcome = TIE;
  if (wins > losses) outcome = WIN;
  else if (wins < losses) outcome = LOSS;

  return { results, wins, losses, ties, outcome };
}

/**
 * Compares one team against every other team that has stats for the period.
 * Returns null when the selected team has no stats for the period.
 */
export function compareAgainstAll(categories, teams, statsByTeam, teamId) {
  const mine = statsByTeam[teamId];
  if (!mine) {
    return null;
  }

  const rows = teams
    .filter((team) => team.id !== teamId && statsByTeam[team.id])
    .map((team) => ({
      team,
      stats: statsByTeam[team.id],
      ...compareTeams(categories, mine, statsByTeam[team.id]),
    }));

  const record = { wins: 0, losses: 0, ties: 0 };
  for (const row of rows) {
    if (row.outcome === WIN) record.wins++;
    else if (row.outcome === LOSS) record.losses++;
    else record.ties++;
  }

  return { mine, rows, record, sweeps: findSweeps(categories, rows) };
}

/**
 * Finds the categories the selected team wins or loses against every opponent.
 * Returns a map of category key to WIN or LOSS; other categories are left out.
 */
export function findSweeps(categories, rows) {
  const sweeps = {};
  if (rows.length === 0) {
    return sweeps;
  }
  for (const category of categories) {
    for (const result of [WIN, LOSS]) {
      if (rows.every((row) => row.results[category.key] === result)) {
        sweeps[category.key] = result;
      }
    }
  }
  return sweeps;
}

/** Formats a stat value the way Yahoo shows it (.453 for percentages). */
export function formatValue(category, value) {
  if (!Number.isFinite(value)) {
    return '-';
  }
  if (category.type === 'pct') {
    return value.toFixed(3).replace(/^0\./, '.');
  }
  return String(value);
}
