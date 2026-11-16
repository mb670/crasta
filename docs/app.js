import { compareAgainstAll, formatValue } from './stats.js';

const SEASON_PERIOD = 'season';
const TEAM_STORAGE_KEY = 'selectedTeamId';

const leagueNameElement = document.getElementById('league-name');
const updatedAtElement = document.getElementById('updated-at');
const teamSelect = document.getElementById('team-select');
const periodSelect = document.getElementById('period-select');
const summaryElement = document.getElementById('summary');
const messageElement = document.getElementById('message');
const tableHead = document.querySelector('#comparison thead');
const tableBody = document.querySelector('#comparison tbody');

init();

async function init() {
  let data;
  try {
    const response = await fetch(`data.json?t=${Date.now()}`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    data = await response.json();
  } catch (error) {
    messageElement.textContent = `Could not load league data (${error.message}).`;
    return;
  }

  leagueNameElement.textContent = data.league.name;
  document.title = `${data.league.name} - Comparison`;
  updatedAtElement.textContent = `Last updated: ${new Date(data.updatedAt).toLocaleString()}`;

  fillTeamSelect(data);
  fillPeriodSelect(data);

  const render = () => renderComparison(data);
  teamSelect.addEventListener('change', () => {
    localStorage.setItem(TEAM_STORAGE_KEY, teamSelect.value);
    render();
  });
  periodSelect.addEventListener('change', render);
  render();
}

function fillTeamSelect(data) {
  const teams = [...data.teams].sort((a, b) => a.name.localeCompare(b.name));
  for (const team of teams) {
    teamSelect.append(new Option(team.name, team.id));
  }
  const remembered = localStorage.getItem(TEAM_STORAGE_KEY);
  if (teams.some((team) => team.id === remembered)) {
    teamSelect.value = remembered;
  }
}

/** Newest week first, season totals last; the newest week is selected by default. */
function fillPeriodSelect(data) {
  const weeks = [...data.weeks].sort((a, b) => b.week - a.week);
  for (const { week } of weeks) {
    periodSelect.append(new Option(`Week ${week}`, String(week)));
  }
  periodSelect.append(new Option('Season totals', SEASON_PERIOD));
}

function statsForPeriod(data, period) {
  if (period === SEASON_PERIOD) {
    return data.season.stats;
  }
  return data.weeks.find((entry) => String(entry.week) === period)?.stats ?? {};
}

function renderComparison(data) {
  const teamId = teamSelect.value;
  const comparison = compareAgainstAll(data.categories, data.teams, statsForPeriod(data, periodSelect.value), teamId);

  tableHead.replaceChildren();
  tableBody.replaceChildren();
  summaryElement.textContent = '';
  messageElement.textContent = '';

  if (!comparison) {
    messageElement.textContent = 'The selected team has no data for this period.';
    return;
  }

  const { record } = comparison;
  summaryElement.textContent =
    `Against ${comparison.rows.length} opponents: ${record.wins} wins, ${record.losses} losses, ${record.ties} ties`;

  const headerRow = tableHead.insertRow();
  for (const title of ['Team', ...data.categories.map((category) => category.key), 'Score']) {
    const cell = document.createElement('th');
    cell.textContent = title;
    headerRow.append(cell);
  }

  const selfRow = tableBody.insertRow();
  selfRow.className = 'self';
  selfRow.insertCell().textContent = data.teams.find((team) => team.id === teamId).name;
  for (const category of data.categories) {
    const cell = selfRow.insertCell();
    cell.textContent = formatValue(category, comparison.mine[category.key]);
    const sweep = comparison.sweeps[category.key];
    if (sweep) {
      cell.className = `sweep-${sweep}`;
    }
  }
  selfRow.insertCell(); // The selected team has no matchup score of its own.

  for (const row of comparison.rows) {
    const tableRow = tableBody.insertRow();
    tableRow.insertCell().textContent = row.team.name;
    for (const category of data.categories) {
      const cell = tableRow.insertCell();
      cell.textContent = formatValue(category, row.stats[category.key]);
      cell.className = row.results[category.key] ?? '';
    }
    const scoreCell = tableRow.insertCell();
    scoreCell.textContent = `${row.wins}-${row.losses}-${row.ties}`;
    scoreCell.className = `score ${row.outcome}`;
  }
}
