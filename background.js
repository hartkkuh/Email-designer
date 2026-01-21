// Email Designer - Background Service Worker
// Note: Spell checking now uses Chrome's built-in spellcheck (no Typo.js needed)

// Listen for extension installation
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // Set default settings
    chrome.storage.local.set({
      savedTemplates: {},
      settings: {
        autoSave: true,
        defaultFont: 'Heebo, sans-serif',
        defaultFontSize: '14px',
        gmailIntegration: false
      }
    });
  }
});

// Listen for messages from popup or content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Spell checking is now handled by Chrome's built-in spellcheck
  // No need for custom dictionary loading

  // Legacy messages
  switch (request.action) {
    case 'getSettings':
      chrome.storage.local.get(['settings'], (result) => {
        sendResponse(result.settings || {});
      });
      return true; // Keep channel open for async response
      
    case 'saveSettings':
      chrome.storage.local.set({ settings: request.settings }, () => {
        sendResponse({ success: true });
      });
      return true;
      
    case 'getTemplates':
      chrome.storage.local.get(['savedTemplates'], (result) => {
        sendResponse(result.savedTemplates || {});
      });
      return true;
      
    case 'saveTemplate':
      chrome.storage.local.get(['savedTemplates'], (result) => {
        const templates = result.savedTemplates || {};
        templates[request.name] = request.html;
        chrome.storage.local.set({ savedTemplates: templates }, () => {
          sendResponse({ success: true });
        });
      });
      return true;
      
    case 'deleteTemplate':
      chrome.storage.local.get(['savedTemplates'], (result) => {
        const templates = result.savedTemplates || {};
        delete templates[request.name];
        chrome.storage.local.set({ savedTemplates: templates }, () => {
          sendResponse({ success: true });
        });
      });
      return true;
  }
});

// Handle extension icon click when not on Gmail
chrome.action.onClicked.addListener((tab) => {
  // The popup will open automatically, this is just for additional logic if needed
});

// Context menu (optional - for future features)
// chrome.contextMenus.create({
//   id: 'email-designer',
//   title: 'Edit with Email Designer',
//   contexts: ['editable'],
//   documentUrlPatterns: ['https://mail.google.com/*']
// });

