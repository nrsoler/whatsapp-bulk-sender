// background.js - Service worker for WhatsApp Bulk Sender
// Handles tab management and cross-tab messaging

chrome.runtime.onInstalled.addListener(() => {
  console.log('[WA Bulk Sender] Extension installed');
});

// Keep service worker alive during sends
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'ping') {
    sendResponse({ alive: true });
  }
  return true;
});
