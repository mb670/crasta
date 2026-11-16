import assert from 'node:assert/strict';
import { test } from 'node:test';

import { compareAgainstAll, compareCategory, compareTeams, formatValue, LOSS, TIE, WIN } from '../docs/stats.js';

const CATEGORIES = [
  { key: 'FG%', type: 'pct', lowerIsBetter: false },
  { key: 'FT%', type: 'pct', lowerIsBetter: false },
  { key: '3PTM', type: 'count', lowerIsBetter: false },
  { key: 'PTS', type: 'count', lowerIsBetter: false },
  { key: 'REB', type: 'count', lowerIsBetter: false },
  { key: 'AST', type: 'count', lowerIsBetter: false },
  { key: 'ST', type: 'count', lowerIsBetter: false },
  { key: 'BLK', type: 'count', lowerIsBetter: false },
  { key: 'TO', type: 'count', lowerIsBetter: true },
];

// Real week 4 matchup; Yahoo scored it 3-6 for Punt of Brothers.
const PUNT_OF_BROTHERS = {
  'FG%': 210 / 464, 'FT%': 118 / 139, '3PTM': 76, PTS: 614, REB: 182, AST: 128, ST: 43, BLK: 42, TO: 86,
};
const DENIZLI = {
  'FG%': 248 / 548, 'FT%': 190 / 228, '3PTM': 77, PTS: 763, REB: 251, AST: 182, ST: 48, BLK: 21, TO: 62,
};

const POINTS = CATEGORIES[3];
const TURNOVERS = CATEGORIES[8];

test('higher value wins a regular category', () => {
  assert.equal(compareCategory(POINTS, 700, 600), WIN);
  assert.equal(compareCategory(POINTS, 600, 700), LOSS);
});

test('lower value wins a lower-is-better category', () => {
  assert.equal(compareCategory(TURNOVERS, 62, 86), WIN);
  assert.equal(compareCategory(TURNOVERS, 86, 62), LOSS);
});

test('equal values tie and missing values give no result', () => {
  assert.equal(compareCategory(POINTS, 600, 600), TIE);
  assert.equal(compareCategory(POINTS, undefined, 600), null);
  assert.equal(compareCategory(POINTS, 600, undefined), null);
});

test('matchup score matches the score Yahoo gave the same matchup', () => {
  const result = compareTeams(CATEGORIES, PUNT_OF_BROTHERS, DENIZLI);

  assert.deepEqual([result.wins, result.losses, result.ties], [3, 6, 0]);
  assert.equal(result.outcome, LOSS);
  // Both teams display .453; the unrounded percentage decides the category.
  assert.equal(result.results['FG%'], WIN);
  assert.equal(result.results.TO, LOSS);
});

test('compareAgainstAll skips the selected team and teams without stats', () => {
  const teams = [
    { id: '6', name: 'Punt of Brothers' },
    { id: '4', name: 'Denizli Cocks' },
    { id: '9', name: 'West Berlin 36ers' },
    { id: '3', name: 'Capital Munchies' },
  ];
  const statsByTeam = { 6: PUNT_OF_BROTHERS, 4: DENIZLI, 9: PUNT_OF_BROTHERS };

  const comparison = compareAgainstAll(CATEGORIES, teams, statsByTeam, '6');

  assert.deepEqual(comparison.rows.map((row) => row.team.id), ['4', '9']);
  assert.deepEqual(comparison.record, { wins: 0, losses: 1, ties: 1 });
  assert.deepEqual([comparison.rows[1].wins, comparison.rows[1].losses, comparison.rows[1].ties], [0, 0, 9]);
});

test('sweeps list only the categories won or lost against every opponent', () => {
  const categories = [POINTS, CATEGORIES[4], CATEGORIES[5], TURNOVERS];
  const teams = [
    { id: '1', name: 'Selected' },
    { id: '2', name: 'First opponent' },
    { id: '3', name: 'Second opponent' },
  ];
  const statsByTeam = {
    1: { PTS: 700, REB: 100, AST: 150, TO: 90 },
    2: { PTS: 600, REB: 200, AST: 100, TO: 60 },
    3: { PTS: 650, REB: 300, AST: 200, TO: 80 },
  };

  const comparison = compareAgainstAll(categories, teams, statsByTeam, '1');

  // PTS beats both, REB loses to both, AST is split, TO is higher (worse) than both.
  assert.deepEqual(comparison.sweeps, { PTS: WIN, REB: LOSS, TO: LOSS });
});

test('a tie against one opponent breaks a sweep, and no opponents means no sweeps', () => {
  const teams = [
    { id: '1', name: 'Selected' },
    { id: '2', name: 'First opponent' },
    { id: '3', name: 'Second opponent' },
  ];
  const statsByTeam = { 1: { PTS: 700 }, 2: { PTS: 600 }, 3: { PTS: 700 } };

  assert.deepEqual(compareAgainstAll([POINTS], teams, statsByTeam, '1').sweeps, {});
  assert.deepEqual(compareAgainstAll([POINTS], teams, { 1: { PTS: 700 } }, '1').sweeps, {});
});

test('compareAgainstAll returns null when the selected team has no stats', () => {
  assert.equal(compareAgainstAll(CATEGORIES, [{ id: '6', name: 'Punt of Brothers' }], {}, '6'), null);
});

test('formatValue shows percentages like Yahoo and dashes for missing values', () => {
  assert.equal(formatValue(CATEGORIES[0], 210 / 464), '.453');
  assert.equal(formatValue(CATEGORIES[0], 1), '1.000');
  assert.equal(formatValue(POINTS, 614), '614');
  assert.equal(formatValue(POINTS, undefined), '-');
});
