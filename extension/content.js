/**
 * Runs inside a Yahoo Fantasy Basketball league tab (injected on toolbar click).
 * Fetches the league pages with the user's own session and downloads the
 * result as data.json.
 */
(async () => {
  'use strict';

  if (window.fantasyExportRunning) {
    return;
  }
  window.fantasyExportRunning = true;

  const REQUEST_DELAY_MS = 300;
  const SCHEMA_VERSION = 1;
  /** Weeks this close to the current one are re-read, because Yahoo applies stat corrections. */
  const REFRESH_WINDOW_WEEKS = 1;
  /** The last export is kept in extension storage so older weeks are not fetched again. */
  const CACHE_KEY = 'lastExport';
  const DOWNLOAD_FILE_NAME = 'data.json';

  const { parseMatchupPage, parseSeasonTotalsPage, parseSelectedWeek, parseLeagueName } = globalThis.FantasyParser;
  const leagueId = /^\/nba\/(\d+)/.exec(location.pathname)?.[1];
  const leaguePath = `/nba/${leagueId}`;
  const panel = createPanel();

  try {
    if (!leagueId) {
      throw new Error('This page is not a league page.');
    }
    const cached = (await chrome.storage.local.get(CACHE_KEY))[CACHE_KEY];
    const data = await scrapeLeague(cached);
    await chrome.storage.local.set({ [CACHE_KEY]: data });

    downloadJson(data);
    panel.setDone(
      `Downloaded ${DOWNLOAD_FILE_NAME}: ${data.weeks.length} weeks, ${data.teams.length} teams. ` +
        'Replace docs/data.json with it and commit.',
    );
  } catch (error) {
    panel.setError(error.message);
  } finally {
    window.fantasyExportRunning = false;
  }

  async function scrapeLeague(previousData) {
    panel.setText('Reading season totals…');
    const season = parseSeasonTotalsPage(await fetchDocument(`${leaguePath}/headtoheadstats?pt=P&type=stats`));
    if (season.teams.length === 0 || season.categories.length === 0) {
      throw new Error('Could not read team stats; the Yahoo page layout may have changed.');
    }

    const currentWeek = parseSelectedWeek(await fetchDocument(`${leaguePath}/matchup`));
    if (!currentWeek) {
      throw new Error('Could not read the current week; the Yahoo page layout may have changed.');
    }
    const leagueName = parseLeagueName(await fetchDocument(leaguePath)) ?? `League ${leagueId}`;

    const reusableWeeks = new Map();
    if (previousData?.schemaVersion === SCHEMA_VERSION && previousData.league?.id === leagueId) {
      for (const entry of previousData.weeks ?? []) {
        reusableWeeks.set(entry.week, entry);
      }
    }

    const weeks = [];
    for (let week = 1; week <= currentWeek; week++) {
      const isSettled = week < currentWeek - REFRESH_WINDOW_WEEKS;
      if (isSettled && reusableWeeks.has(week)) {
        weeks.push(reusableWeeks.get(week));
        continue;
      }
      panel.setText(`Reading week ${week} of ${currentWeek}…`);
      const stats = await scrapeWeek(week, season.teams);
      if (Object.keys(stats).length > 0) {
        weeks.push({ week, stats });
      }
    }

    return {
      schemaVersion: SCHEMA_VERSION,
      league: { id: leagueId, name: leagueName },
      updatedAt: new Date().toISOString(),
      currentWeek,
      categories: season.categories,
      teams: season.teams.map(({ id, name }) => ({ id, name })),
      season: { stats: Object.fromEntries(season.teams.map((team) => [team.id, team.stats])) },
      weeks,
    };
  }

  /** Reads one matchup page per pairing; each page holds the totals of both teams. */
  async function scrapeWeek(week, teams) {
    const stats = {};
    const covered = new Set();

    for (const team of teams) {
      if (covered.has(team.id)) {
        continue;
      }
      covered.add(team.id);

      const page = parseMatchupPage(await fetchDocument(`${leaguePath}/matchup?week=${week}&mid1=${team.id}`));
      for (const row of page.teams) {
        covered.add(row.id);
        if (Object.keys(row.stats).length > 0) {
          stats[row.id] = row.stats;
        }
      }
      await new Promise((resolve) => setTimeout(resolve, REQUEST_DELAY_MS));
    }

    return stats;
  }

  async function fetchDocument(path) {
    let response;
    try {
      response = await fetch(path, { credentials: 'include' });
    } catch {
      throw new Error('Could not load the Yahoo page; make sure you are signed in.');
    }
    if (!response.ok || !new URL(response.url).pathname.startsWith(leaguePath)) {
      throw new Error(`Could not load the Yahoo page (${response.status}): ${path}`);
    }
    return new DOMParser().parseFromString(await response.text(), 'text/html');
  }

  function downloadJson(data) {
    const blob = new Blob([`${JSON.stringify(data, null, 1)}\n`], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = DOWNLOAD_FILE_NAME;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function createPanel() {
    document.getElementById('fantasy-export-panel')?.remove();

    const element = document.createElement('div');
    element.id = 'fantasy-export-panel';
    element.style.cssText = [
      'position:fixed', 'right:16px', 'bottom:16px', 'z-index:2147483647', 'max-width:320px',
      'padding:12px 16px', 'border-radius:8px', 'background:#1d1d1f', 'color:#fff',
      'font:14px/1.4 system-ui,sans-serif', 'box-shadow:0 4px 16px rgba(0,0,0,.35)',
    ].join(';');
    document.body.appendChild(element);

    const show = (text, color) => {
      element.textContent = text;
      element.style.background = color;
    };

    return {
      setText: (text) => show(text, '#1d1d1f'),
      setError: (text) => show(`Error: ${text}`, '#a12622'),
      setDone: (text) => show(text, '#1b6e3c'),
    };
  }
})();
