// MV3 service worker. Currently a placeholder; alarms/notifications land in v2.
chrome.runtime.onInstalled.addListener(details => {
  if (details.reason === 'install') {
    chrome.runtime.openOptionsPage();
  }
});

export {};
