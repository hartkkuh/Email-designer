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

  // Initialize
})();
