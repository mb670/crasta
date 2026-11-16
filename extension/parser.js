/**
 * Parsers for Yahoo Fantasy Basketball league pages.
 *
 * Loaded as a classic content script; exposes its functions on
 * globalThis.FantasyParser. All functions take a parsed Document.
 */
(() => {
  'use strict';

  /** Categories where the lower value wins. */
  const LOWER_IS_BETTER_KEYS = new Set(['TO']);

  /** Yahoo marks display-only columns (e.g. "FGM/A*") and tie-broken values (".453*") with this. */
  const FOOTNOTE_MARK = '*';

  const cleanText = (node) => (node ? node.textContent.replace(/\s+/g, ' ').trim() : '');

  function teamIdFromHref(href) {
    const match = /\/nba\/\d+\/(\d+)(?:[/?#]|$)/.exec(href || '');
    return match ? match[1] : null;
  }

  function parseNumber(text) {
    const value = Number.parseFloat(text.replace(/[,*]/g, ''));
    return Number.isFinite(value) ? value : null;
  }

  /** Turns "210/464" into 0.4525...; returns null for "-/-" or zero attempts. */
  function parseMadeAttempted(text) {
    const match = /^(\d+)\s*\/\s*(\d+)$/.exec(text);
    if (!match) {
      return null;
    }
    const attempted = Number(match[2]);
    return attempted > 0 ? Number(match[1]) / attempted : null;
  }

  function isScoringHeader(header, index) {
    return index > 0 && header !== '' && !header.endsWith(FOOTNOTE_MARK);
  }

  function buildCategory(key) {
    return {
      key,
      type: key.endsWith('%') ? 'pct' : 'count',
      lowerIsBetter: LOWER_IS_BETTER_KEYS.has(key),
    };
  }

  /**
   * Parses a table whose first row holds category names and whose other rows
   * hold one team each, with a team link in the first cell.
   *
   * Percentages are computed from the made/attempted column when Yahoo shows
   * one, because the displayed value is rounded to three decimals and Yahoo
   * breaks ties on the unrounded value.
   */
  function parseTeamTable(table) {
    const headers = [...table.rows[0].cells].map(cleanText);
    const categories = headers.filter(isScoringHeader).map(buildCategory);
    const teams = [];

    for (const row of [...table.rows].slice(1)) {
      const cells = [...row.cells];
      const anchors = [...cells[0].querySelectorAll('a[href]')];
      const id = anchors.map((anchor) => teamIdFromHref(anchor.getAttribute('href'))).find(Boolean);
      if (!id) {
        continue;
      }
      const name = anchors.map(cleanText).find(Boolean) || cleanText(cells[0]);

      const stats = {};
      headers.forEach((header, index) => {
        if (!isScoringHeader(header, index)) {
          return;
        }
        let value = null;
        if (header.endsWith('%')) {
          const ratioIndex = headers.indexOf(`${header.slice(0, -1)}M/A${FOOTNOTE_MARK}`);
          if (ratioIndex !== -1) {
            value = parseMadeAttempted(cleanText(cells[ratioIndex]));
          }
        }
        if (value === null) {
          value = parseNumber(cleanText(cells[index]));
        }
        if (value !== null) {
          stats[header] = value;
        }
      });

      teams.push({ id, name, stats });
    }

    return { categories, teams };
  }

  const EMPTY_RESULT = Object.freeze({ categories: [], teams: [] });

  /** Parses the two team total rows at the top of a matchup page. */
  function parseMatchupPage(doc) {
    const table = doc.querySelector('#matchup-wall-header table');
    return table ? parseTeamTable(table) : EMPTY_RESULT;
  }

  /** Parses the "Team Stats > Totals" page (season totals for every team). */
  function parseSeasonTotalsPage(doc) {
    const table = [...doc.querySelectorAll('table')].find(
      (candidate) => candidate.rows.length > 1 && cleanText(candidate.rows[0].cells[0]) === 'Team Name',
    );
    return table ? parseTeamTable(table) : EMPTY_RESULT;
  }

  /** Reads the selected week from the week dropdown of a matchup page. */
  function parseSelectedWeek(doc) {
    for (const option of doc.querySelectorAll('select option[selected]')) {
      const match = /[?&]week=(\d+)/.exec(option.getAttribute('value') || '');
      if (match) {
        return Number(match[1]);
      }
    }
    return null;
  }

  /** Reads the league name from the league home page title ("<name> | Fantasy Basketball | ..."). */
  function parseLeagueName(doc) {
    const [first, second] = (doc.title || '').split('|').map((part) => part.trim());
    return first && second === 'Fantasy Basketball' ? first : null;
  }

  globalThis.FantasyParser = {
    parseMatchupPage,
    parseSeasonTotalsPage,
    parseSelectedWeek,
    parseLeagueName,
  };
})();
