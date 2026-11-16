/**
 * Service worker: starts the export in the active Yahoo league tab when the
 * toolbar button is clicked.
 */

const YAHOO_HOME_URL = 'https://basketball.fantasysports.yahoo.com/';
const YAHOO_LEAGUE_URL_PATTERN = /^https:\/\/basketball\.fantasysports\.yahoo\.com\/nba\/\d+/;

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id || !YAHOO_LEAGUE_URL_PATTERN.test(tab.url ?? '')) {
    await chrome.tabs.create({ url: YAHOO_HOME_URL });
    return;
  }
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['parser.js', 'content.js'],
  });
});
