// Email Designer - Content Script
// This script runs in the context of email service pages (Gmail, Outlook, Yahoo, ProtonMail)

(function() {
  'use strict';

  // Prevent multiple initializations
  if (window._emailHtmlEditorLoaded) {
    return;
  }
  window._emailHtmlEditorLoaded = true;

  // Detect which email service we're on
  function detectEmailService() {
    const hostname = window.location.hostname;
    
    if (hostname.includes('mail.google.com')) {
      return 'gmail';
    } else if (hostname.includes('outlook.live.com') || 
               hostname.includes('outlook.office.com') || 
               hostname.includes('outlook.office365.com')) {
      return 'outlook';
    } else if (hostname.includes('mail.yahoo.com')) {
      return 'yahoo';
    } else if (hostname.includes('mail.proton.me') || 
               hostname.includes('mail.protonmail.com')) {
      return 'protonmail';
    }
    
    return 'unknown';
  }

  const emailService = detectEmailService();

  // Selectors for each email service
  const serviceSelectors = {
    gmail: {
      body: [
        'div[aria-label="גוף ההודעה"]',
        'div[aria-label="Message Body"]',
        'div[aria-label="גוף ההודעה"][contenteditable="true"]',
        'div[aria-label="Message Body"][contenteditable="true"]',
        'div.Am.Al.editable',
        'div.Am.aO9.Al.editable',
        'div[role="textbox"][aria-label*="Body"]',
        'div[role="textbox"][aria-label*="גוף"]',
        'div[contenteditable="true"][aria-multiline="true"]',
        'div.M9 div[contenteditable="true"]',
        'div.AD div[contenteditable="true"]',
        'div[role="dialog"] div[contenteditable="true"]',
        'div[data-message-id] div[contenteditable="true"]',
        'div.gmail_default[contenteditable="true"]',
        'div.editable[contenteditable="true"]'
      ],
      subject: [
        'input[aria-label="נושא"]',
        'input[aria-label="Subject"]',
        'input[name="subjectbox"]',
        'input.aoT',
        'div[role="dialog"] input[type="text"]',
        'input[placeholder*="נושא"]',
        'input[placeholder*="Subject"]'
      ]
    },
    outlook: {
      body: [
        'div[role="textbox"][aria-label*="Message body"]',
        'div[role="textbox"][aria-label*="גוף ההודעה"]',
        'div[aria-label="Message body, press Alt+F10 to exit"]',
        'div[contenteditable="true"][aria-label*="Message"]',
        'div.dFCbN[contenteditable="true"]',
        'div.elementToProof[contenteditable="true"]',
        'div[data-testid="compose-message-body"]',
        'div.RichTextEditor div[contenteditable="true"]',
        'div.customScrollBar div[contenteditable="true"]',
        'div[role="document"][contenteditable="true"]',
        'div._2AOJe[contenteditable="true"]'
      ],
      subject: [
        'input[aria-label="Add a subject"]',
        'input[aria-label="הוסף נושא"]',
        'input[placeholder="Add a subject"]',
        'input[placeholder="הוסף נושא"]',
        'input[data-testid="compose-subject"]',
        'input.ms-TextField-field[type="text"]'
      ]
    },
    yahoo: {
      body: [
        'div[data-test-id="compose-editor-container"] div[contenteditable="true"]',
        'div[aria-label="Message body"]',
        'div.compose-editor div[contenteditable="true"]',
        'div.DraftEditor-root div[contenteditable="true"]',
        'div[data-testid="rte"] div[contenteditable="true"]',
        'div.Fm\\(1\\) div[contenteditable="true"]',
        'div[role="textbox"][contenteditable="true"]',
        'div.editorContainer div[contenteditable="true"]'
      ],
      subject: [
        'input[data-test-id="compose-subject"]',
        'input[placeholder="Subject"]',
        'input[placeholder="נושא"]',
        'input[aria-label="Subject"]',
        'input.Fz\\(16px\\)'
      ]
    },
    protonmail: {
      body: [
        'div[contenteditable="true"].angular-editor-textarea',
        'div[contenteditable="true"].protonmail-editor-container',
        'div.composer-editor-embedded div[contenteditable="true"]',
        'div.composer-body-container div[contenteditable="true"]',
        'iframe.composer-body-container',
        'div[data-testid="composer:body"] div[contenteditable="true"]',
        'div.editor-squire-wrapper div[contenteditable="true"]',
        'div[contenteditable="true"][spellcheck="true"]'
      ],
      subject: [
        'input[data-testid="composer:subject"]',
        'input[placeholder="Subject"]',
        'input[placeholder="נושא"]',
        'input.composer-subject-input',
        'input[id*="subject"]'
      ]
    }
  };

  // Listen for messages from the popup (only once)
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'insertHtml') {
      const bodySuccess = insertHtmlToEmail(request.html);
      
      // Also insert subject if provided
      if (request.subject) {
        insertSubjectToEmail(request.subject);
      }
      
      sendResponse({ success: bodySuccess, service: emailService });
      return true; // Keep the message channel open
    }
    
    if (request.action === 'detectService') {
      sendResponse({ service: emailService });
      return true;
    }
    
    return false; // Don't keep channel open for other messages
  });
  
  // Find and insert subject into email compose window
  function insertSubjectToEmail(subject) {
    const selectors = serviceSelectors[emailService]?.subject || [];
    
    // Also try generic selectors
    const genericSelectors = [
      'input[name="subject"]',
      'input[type="text"][placeholder*="ubject"]',
      'input[type="text"][placeholder*="נושא"]'
    ];
    
    const allSelectors = [...selectors, ...genericSelectors];
    
    let subjectField = null;
    
    for (const selector of allSelectors) {
      try {
        const el = document.querySelector(selector);
        if (el && isVisible(el)) {
          subjectField = el;
          break;
        }
      } catch (e) {
        // Invalid selector, skip
      }
    }
    
    if (subjectField) {
      subjectField.value = subject;
      subjectField.dispatchEvent(new Event('input', { bubbles: true }));
      subjectField.dispatchEvent(new Event('change', { bubbles: true }));
      // For React-based apps
      try {
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        nativeInputValueSetter.call(subjectField, subject);
        subjectField.dispatchEvent(new Event('input', { bubbles: true }));
      } catch (e) {
        // Ignore if native setter fails
      }
      
      return true;
    }
    
    return false;
  }

  // Find and insert HTML into email compose window
  function insertHtmlToEmail(html) {
    const selectors = serviceSelectors[emailService]?.body || [];
    
    // Also try generic selectors
    const genericSelectors = [
      'div[contenteditable="true"][role="textbox"]',
      'div[contenteditable="true"]'
    ];
    
    const allSelectors = [...selectors, ...genericSelectors];

    let composeBody = null;

    // Try each selector - find the FIRST valid one only
    for (const selector of allSelectors) {
      try {
        const elements = document.querySelectorAll(selector);
        for (const el of elements) {
          if (isVisible(el) && isComposeArea(el)) {
            composeBody = el;
            break;
          }
        }
        if (composeBody) break;
      } catch (e) {
        // Invalid selector, skip
      }
    }

    // Special handling for ProtonMail iframe
    if (!composeBody && emailService === 'protonmail') {
      const iframe = document.querySelector('iframe.composer-body-container, iframe[title*="Composer"]');
      if (iframe && iframe.contentDocument) {
        composeBody = iframe.contentDocument.body;
      }
    }

    if (!composeBody) {
      return false;
    }

    try {
      // Focus the compose area
      composeBody.focus();

      // Extract body style, content, and HTML attributes
      const { bodyStyle, bodyContent, htmlDir, htmlLang } = extractBodyContent(html);
      
      // Insert the HTML content
      const wrapper = document.createElement('div');
      
      // Apply HTML attributes to wrapper if they exist
      if (htmlDir) {
        wrapper.setAttribute('dir', htmlDir);
      }
      if (htmlLang) {
        wrapper.setAttribute('lang', htmlLang);
      }
      
      // Apply body style directly to wrapper if it exists
      if (bodyStyle && bodyStyle.trim()) {
        // Add additional CSS to ensure background displays correctly in email
        const enhancedStyle = bodyStyle + 
          '; min-height: 100%; width: 100%; box-sizing: border-box;' +
          (bodyStyle.includes('background') ? ' background-attachment: scroll;' : '');
        wrapper.setAttribute('style', enhancedStyle);
      } else {
        // Even if no style, ensure wrapper has proper dimensions
        wrapper.setAttribute('style', 'min-height: 100%; width: 100%; box-sizing: border-box;');
      }
      
      wrapper.innerHTML = bodyContent;
      
      // Insert at cursor position or append
      const selection = window.getSelection();
      if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        if (composeBody.contains(range.commonAncestorContainer)) {
          range.deleteContents();
          range.insertNode(wrapper);
          range.setStartAfter(wrapper);
          range.collapse(true);
          selection.removeAllRanges();
          selection.addRange(range);
        } else {
          composeBody.appendChild(wrapper);
        }
      } else {
        composeBody.appendChild(wrapper);
      }

      // Trigger input event to notify the app of changes
      composeBody.dispatchEvent(new Event('input', { bubbles: true }));
      composeBody.dispatchEvent(new Event('change', { bubbles: true }));
      
      // For React-based apps (Outlook, etc.)
      try {
        const inputEvent = new InputEvent('input', {
          bubbles: true,
          cancelable: true,
          inputType: 'insertText'
        });
        composeBody.dispatchEvent(inputEvent);
      } catch (e) {
        // Ignore if InputEvent fails
      }
      
      return true;
    } catch (error) {
      console.error(`Email HTML Editor: Error inserting content (${emailService})`, error);
      return false;
    }
  }

  // Check if element is visible
  function isVisible(el) {
    if (!el) return false;
    try {
      const style = window.getComputedStyle(el);
      return style.display !== 'none' && 
             style.visibility !== 'hidden' && 
             el.offsetWidth > 0 && 
             el.offsetHeight > 0;
    } catch (e) {
      return false;
    }
  }

  // Check if element is likely a compose area
  function isComposeArea(el) {
    // Must be contenteditable (or body for iframe)
    if (el.contentEditable !== 'true' && el.tagName !== 'BODY') return false;
    
    // Should have reasonable size
    const rect = el.getBoundingClientRect();
    if (rect.width < 100 || rect.height < 30) return false;
    
    // Service-specific checks
    if (emailService === 'gmail') {
      const parent = el.closest('div[role="dialog"], div.AD, div.M9, div.nH');
      return parent !== null || el.closest('form') !== null;
    }
    
    if (emailService === 'outlook') {
      return el.closest('[role="dialog"], [data-testid*="compose"], .customScrollBar') !== null ||
             el.getAttribute('aria-label')?.includes('Message') ||
             el.getAttribute('aria-label')?.includes('הודעה');
    }
    
    if (emailService === 'yahoo') {
      return el.closest('[data-test-id*="compose"], .compose-editor') !== null ||
             el.parentElement?.classList.contains('DraftEditor-root');
    }
    
    if (emailService === 'protonmail') {
      return el.closest('.composer-body-container, .composer-editor') !== null ||
             el.classList.contains('angular-editor-textarea');
    }
    
    return true; // Generic fallback
  }

  // Extract body style, content, and HTML attributes from full HTML document
  function extractBodyContent(html) {
    let bodyStyle = '';
    let bodyContent = '';
    let htmlDir = '';
    let htmlLang = '';
    
    // Extract HTML tag attributes (dir, lang)
    const htmlTagMatch = html.match(/<html([^>]*)>/i);
    if (htmlTagMatch) {
      const htmlAttributes = htmlTagMatch[1];
      const dirMatch = htmlAttributes.match(/dir\s*=\s*["']([^"']*)["']/i);
      const langMatch = htmlAttributes.match(/lang\s*=\s*["']([^"']*)["']/i);
      
      if (dirMatch) {
        htmlDir = dirMatch[1].trim();
      }
      if (langMatch) {
        htmlLang = langMatch[1].trim();
      }
    }
    
    // Parse HTML to extract body tag attributes and content
    const bodyTagMatch = html.match(/<body([^>]*)>([\s\S]*)<\/body>/i);
    
    if (bodyTagMatch) {
      const bodyAttributes = bodyTagMatch[1];
      bodyContent = bodyTagMatch[2];
      
      // Extract style attribute value - handle both single and double quotes
      const styleMatchDouble = bodyAttributes.match(/style\s*=\s*"([^"]*(?:\\.[^"]*)*)"/i);
      const styleMatchSingle = bodyAttributes.match(/style\s*=\s*'([^']*(?:\\.[^']*)*)'/i);
      
      if (styleMatchDouble) {
        // Unescape the style value for double quotes
        bodyStyle = styleMatchDouble[1]
          .replace(/\\"/g, '"')
          .replace(/\\'/g, "'")
          .replace(/\\n/g, ' ')
          .replace(/\\t/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
      } else if (styleMatchSingle) {
        // Unescape the style value for single quotes
        bodyStyle = styleMatchSingle[1]
          .replace(/\\'/g, "'")
          .replace(/\\"/g, '"')
          .replace(/\\n/g, ' ')
          .replace(/\\t/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
      }
    } else {
      // Fallback: if no body tag found, use entire HTML as content
      bodyContent = html;
    }
    
    return { bodyStyle, bodyContent, htmlDir, htmlLang };
  }

  // ===========================================
  // EMBEDDED EDITOR INTEGRATION (Full UI)
  // Supports: Gmail, Outlook, Yahoo, ProtonMail
  // ===========================================
  
  // Run for all supported email services
  if (emailService !== 'unknown') {
    let emailIntegrationEnabled = false;
    const processedComposeWindows = new WeakSet();
    
    // Service-specific compose dialog selectors
    const composeDialogSelectors = {
      gmail: ['div[role="dialog"]', '.AD', '.M9', 'div.nH[role="main"]'],
      outlook: [
        'div[role="dialog"]',
        'div[data-app-section="ConversationContainer"]',
        'div.customScrollBar',
        'div[aria-label*="compose"]',
        'div[aria-label*="Compose"]',
        'div[aria-label*="כתיבה"]',
        'div[class*="___ComposeMessage"]',
        'div[data-testid="ComposePaneContent"]'
      ],
      yahoo: [
        'div[data-test-id="compose-header"]',
        'div[data-test-id="compose-editor-container"]',
        'div.compose-editor',
        'div[class*="compose"]'
      ],
      protonmail: [
        'div.composer-container',
        'div[class*="composer"]',
        'div.composer',
        'div[data-testid="composer:container"]'
      ]
    };
    
    // Helper to check if extension context is still valid
    function isExtensionContextValid() {
      try {
        return !!chrome.runtime?.id;
      } catch (e) {
        return false;
      }
    }
    
    // Check if email integration is enabled
    function checkEmailIntegration() {
      return new Promise((resolve) => {
        if (!isExtensionContextValid()) {
          resolve(false);
          return;
        }
        try {
          chrome.storage.local.get(['settings'], (result) => {
            // Support both old 'gmailIntegration' and new 'emailIntegration' keys
            emailIntegrationEnabled = result.settings?.gmailIntegration || result.settings?.emailIntegration || false;
            resolve(emailIntegrationEnabled);
          });
        } catch (e) {
          resolve(false);
        }
      });
    }
    
    // Listen for storage changes
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (!isExtensionContextValid()) return;
      if (namespace === 'local' && changes.settings) {
        emailIntegrationEnabled = changes.settings.newValue?.gmailIntegration || changes.settings.newValue?.emailIntegration || false;
        
        // If disabled, remove all injected editors
        if (!emailIntegrationEnabled) {
          removeAllInjectedEditors();
        }
      }
    });
    
    // Find compose body element for current service
    function findComposeBody(container) {
      const selectors = serviceSelectors[emailService]?.body || [];
      for (const selector of selectors) {
        try {
          const el = container.querySelector(selector);
          if (el && isVisible(el) && isComposeArea(el)) {
            return el;
          }
        } catch (e) {
          // Invalid selector
        }
      }
      
      // Special handling for ProtonMail iframe
      if (emailService === 'protonmail') {
        const iframe = container.querySelector('iframe.composer-body-container, iframe[title*="Composer"]');
        if (iframe && iframe.contentDocument) {
          return iframe.contentDocument.body;
        }
      }
      
      return null;
    }
    
    // Find subject field for current service
    function findSubjectField(container) {
      const selectors = serviceSelectors[emailService]?.subject || [];
      for (const selector of selectors) {
        try {
          const el = container.querySelector(selector);
          if (el && isVisible(el)) {
            return el;
          }
        } catch (e) {
          // Invalid selector
        }
      }
      // Try to find in document if not in container
      for (const selector of selectors) {
        try {
          const el = document.querySelector(selector);
          if (el && isVisible(el)) {
            return el;
          }
        } catch (e) {
          // Invalid selector
        }
      }
      return null;
    }
    
    // Get the subject field container selector based on service
    function getSubjectContainerSelector() {
      switch (emailService) {
        case 'gmail':
          return 'tr, .aoD, .aox, [class*="subject"], div:has(> input[name="subjectbox"])';
        case 'outlook':
          return 'div[class*="subject"], div:has(> input[aria-label*="subject"]), div:has(> input[aria-label*="נושא"])';
        case 'yahoo':
          return 'div[data-test-id="compose-subject"], div:has(> input[placeholder*="Subject"])';
        case 'protonmail':
          return 'div.composer-subject, div:has(> input[data-testid="composer:subject"])';
        default:
          return null;
      }
    }
    
    // Inject the full editor UI into a compose window
    function injectEditor(composeDialog) {
      // Check if extension context is still valid
      if (!isExtensionContextValid()) return;
      
      if (processedComposeWindows.has(composeDialog)) return;
      
      const composeBody = findComposeBody(composeDialog);
      if (!composeBody) return;
      
      processedComposeWindows.add(composeDialog);
      
      // Get the parent container of the compose body
      const composeBodyContainer = composeBody.parentElement;
      if (!composeBodyContainer) return;
      
      // Find and hide the email service's subject field
      const subjectField = findSubjectField(composeDialog);
      let subjectContainer = null;
      if (subjectField) {
        // Find the row/container that holds the subject field
        const containerSelector = getSubjectContainerSelector();
        if (containerSelector) {
          subjectContainer = subjectField.closest(containerSelector);
        }
        if (!subjectContainer) {
          subjectContainer = subjectField.parentElement?.parentElement;
        }
        if (subjectContainer) {
          subjectContainer.style.display = 'none';
          subjectContainer.dataset.edHiddenSubject = 'true';
        }
      }
      
      // Double-check context before using chrome.runtime.getURL
      if (!isExtensionContextValid()) return;
      
      // Create iframe container
      const iframeContainer = document.createElement('div');
      iframeContainer.className = 'email-designer-embedded-container';
      let popupUrl;
      try {
        popupUrl = chrome.runtime.getURL('popup.html');
      } catch (e) {
        return;
      }
      iframeContainer.innerHTML = `
        <div class="ed-header-bar">
          <span class="ed-title">Email Designer</span>
          <button class="ed-close-btn" title="Close editor">✕</button>
        </div>
        <iframe class="email-designer-iframe" src="${popupUrl}?embedded=true"></iframe>
      `;
      
      // Hide the original compose body
      composeBody.style.display = 'none';
      composeBody.dataset.edHidden = 'true';
      
      // Insert our editor container
      composeBodyContainer.insertBefore(iframeContainer, composeBody);
      
      // Get iframe reference
      const iframe = iframeContainer.querySelector('.email-designer-iframe');
      
      // Close button - switch back to normal editor
      iframeContainer.querySelector('.ed-close-btn')?.addEventListener('click', () => {
        removeInjectedEditor(composeDialog);
      });
      
      // Listen for messages from the iframe
      window.addEventListener('message', function handleIframeMessage(event) {
        // Verify the message is from our iframe
        if (event.source !== iframe.contentWindow) return;
        
        const { type, html, subject } = event.data || {};
        
        if (type === 'insertToEmail') {
          // Insert the HTML to the compose body
          const { bodyContent } = extractBodyContent(html);
          composeBody.innerHTML = bodyContent;
          composeBody.dispatchEvent(new Event('input', { bubbles: true }));
          
          // For React-based apps (Outlook, Yahoo)
          triggerReactUpdate(composeBody);
          
          // Insert subject if provided
          if (subject) {
            insertSubjectToEmail(subject);
          }
        }
        
        if (type === 'editorReady') {
          // Send current compose content to iframe
          const currentSubject = subjectField ? subjectField.value : '';
          iframe.contentWindow.postMessage({
            type: 'loadContent',
            html: composeBody.innerHTML,
            subject: currentSubject
          }, '*');
        }
        
        if (type === 'contentChanged') {
          // Sync content to email service
          if (html) {
            const { bodyContent } = extractBodyContent(html);
            composeBody.innerHTML = bodyContent;
            composeBody.dispatchEvent(new Event('input', { bubbles: true }));
            triggerReactUpdate(composeBody);
          }
          // Sync subject
          if (subject !== undefined && subjectField) {
            subjectField.value = subject;
            subjectField.dispatchEvent(new Event('input', { bubbles: true }));
            subjectField.dispatchEvent(new Event('change', { bubbles: true }));
            triggerReactUpdate(subjectField);
          }
        }
      });
    }
    
    // Trigger React update for React-based apps
    function triggerReactUpdate(element) {
      try {
        const inputEvent = new InputEvent('input', {
          bubbles: true,
          cancelable: true,
          inputType: 'insertText'
        });
        element.dispatchEvent(inputEvent);
        
        // For React controlled inputs
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
          element.tagName === 'INPUT' ? window.HTMLInputElement.prototype : window.HTMLTextAreaElement.prototype,
          'value'
        )?.set;
        if (nativeInputValueSetter && element.value !== undefined) {
          nativeInputValueSetter.call(element, element.value);
          element.dispatchEvent(new Event('input', { bubbles: true }));
        }
      } catch (e) {
        // Ignore if native setter fails
      }
    }
    
    // Remove injected editor from a compose window
    function removeInjectedEditor(composeDialog) {
      const editorContainer = composeDialog.querySelector('.email-designer-embedded-container');
      const composeBody = composeDialog.querySelector('[data-ed-hidden="true"]');
      const subjectContainer = composeDialog.querySelector('[data-ed-hidden-subject="true"]');
      
      if (editorContainer && composeBody) {
        // Show the original compose body again
        composeBody.style.display = '';
        delete composeBody.dataset.edHidden;
        
        // Show the subject field again
        if (subjectContainer) {
          subjectContainer.style.display = '';
          delete subjectContainer.dataset.edHiddenSubject;
        }
        
        // Remove our editor
        editorContainer.remove();
        
        // Allow re-injection
        processedComposeWindows.delete(composeDialog);
      }
    }
    
    // Remove all injected editors
    function removeAllInjectedEditors() {
      document.querySelectorAll('.email-designer-embedded-container').forEach(container => {
        const selectors = composeDialogSelectors[emailService] || ['div[role="dialog"]'];
        const composeDialog = container.closest(selectors.join(', '));
        if (composeDialog) {
          removeInjectedEditor(composeDialog);
        } else {
          container.remove();
        }
      });
    }
    
    // Get compose dialog selectors for current service
    function getComposeDialogSelectors() {
      return composeDialogSelectors[emailService] || ['div[role="dialog"]'];
    }
    
    // Watch for compose windows opening
    function initComposeObserver() {
      const dialogSelectors = getComposeDialogSelectors();
      
      const observer = new MutationObserver(async (mutations) => {
        if (!emailIntegrationEnabled) return;
        if (!isExtensionContextValid()) return;
        
        for (const mutation of mutations) {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              // Check if this is a compose dialog or contains one
              for (const selector of dialogSelectors) {
                try {
                  const dialogs = node.matches?.(selector) 
                    ? [node] 
                    : node.querySelectorAll?.(selector) || [];
                  
                  for (const dialog of dialogs) {
                    // Wait a bit for the email service to fully render the compose window
                    setTimeout(() => {
                      if (!isExtensionContextValid()) return;
                      if (emailIntegrationEnabled && findComposeBody(dialog)) {
                        injectEditor(dialog);
                      }
                    }, 500);
                  }
                } catch (e) {
                  // Invalid selector, skip
                }
              }
            }
          }
        }
      });
      
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
      
      return observer;
    }
    
    // Initialize email integration
    async function initEmailIntegration() {
      await checkEmailIntegration();
      
      // Inject styles
      injectEditorStyles();
      
      if (emailIntegrationEnabled) {
        // Check for any existing compose windows
        const dialogSelectors = getComposeDialogSelectors();
        for (const selector of dialogSelectors) {
          try {
            document.querySelectorAll(selector).forEach(container => {
              if (findComposeBody(container)) {
                injectEditor(container);
              }
            });
          } catch (e) {
            // Invalid selector, skip
          }
        }
      }
      
      // Start watching for new compose windows
      initComposeObserver();
    }
    
    // Inject CSS styles for the embedded editor container
    function injectEditorStyles() {
      if (document.getElementById('email-designer-embedded-styles')) return;
      
      const style = document.createElement('style');
      style.id = 'email-designer-embedded-styles';
      style.textContent = `
        .email-designer-embedded-container {
          display: flex;
          flex-direction: column;
          border: 2px solid #6366f1;
          border-radius: 12px;
          overflow: hidden;
          background: #0f0f13;
          margin: 8px 0;
          box-shadow: 0 8px 32px rgba(99, 102, 241, 0.3);
          z-index: 9999;
          position: relative;
        }
        
        .ed-header-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 12px;
          background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%);
          color: white;
          font-family: 'Heebo', Arial, sans-serif;
        }
        
        .ed-title {
          font-weight: 600;
          font-size: 14px;
        }
        
        .ed-close-btn {
          width: 24px;
          height: 24px;
          border: none;
          background: rgba(255,255,255,0.2);
          color: white;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.2s;
        }
        
        .ed-close-btn:hover {
          background: rgba(255,255,255,0.3);
        }
        
        .email-designer-iframe {
          width: 100%;
          height: 550px;
          border: none;
          background: #0f0f13;
        }
      `;
      
      document.head.appendChild(style);
    }
    
    // Start initialization
    initEmailIntegration();
  }

  // Initialize
})();
