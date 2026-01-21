// Spell Checker using Chrome's built-in spellcheck
// Uses emailLanguage (message language) not interface language
// Minimal wrapper - Chrome handles everything automatically

// Mapping from language codes to Chrome spellcheck language codes
const languageToSpellcheck = {
  'en': 'en-US',
  'he': 'he-IL',
  'es': 'es-ES',
  'fr': 'fr-FR',
  'de': 'de-DE',
  'ru': 'ru-RU',
  'pt': 'pt-PT',
  'ar': 'ar',
  'zh_CN': 'zh-CN'
};

let currentSpellCheckLang = null;

/**
 * Initialize spell checker with language
 * @param {string} lang - Language code (e.g., 'he', 'en')
 */
function initSpellChecker(lang) {
  const editor = document.getElementById('editor');
  if (!editor) return;

  // Get Chrome spellcheck language code
  const spellcheckLang = languageToSpellcheck[lang] || lang;
  
  // Store current language
  currentSpellCheckLang = lang;
  
  // Enable spellcheck and set language - Chrome does the rest
  // For contenteditable, we need to set it on the element itself
  editor.setAttribute('spellcheck', 'true');
  editor.setAttribute('lang', spellcheckLang);
  editor.spellcheck = true; // Also set as property (some browsers need this)
  
  // Also set lang on all paragraphs inside (for better spellcheck support)
  // Chrome spellcheck works better when lang is set on the actual text containers
  const paragraphs = editor.querySelectorAll('p');
  paragraphs.forEach(p => {
    p.setAttribute('spellcheck', 'true');
    p.setAttribute('lang', spellcheckLang);
    p.spellcheck = true;
    // Also set on the element itself as property
    if (p.contentEditable !== 'false') {
      p.contentEditable = 'true';
    }
  });
  
  // Set lang on the editor wrapper as well
  const editorWrapper = editor.parentElement;
  if (editorWrapper) {
    editorWrapper.setAttribute('lang', spellcheckLang);
  }
  
  // Force spellcheck to refresh
  // Chrome spellcheck needs the element to be focused and have content
  setTimeout(() => {
    // Ensure editor has focus for spellcheck to work
    if (document.activeElement !== editor) {
      editor.focus();
    }
    
    // Trigger spellcheck by simulating typing (Chrome needs this for contenteditable)
    const selection = window.getSelection();
    if (selection.rangeCount === 0) {
      const range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(false); // Move to end
      selection.removeAllRanges();
      selection.addRange(range);
    }
    
    // Dispatch input event to trigger spellcheck
    editor.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
  }, 100);
  
}

/**
 * Initialize spell checker event listeners
 * Just ensures spellcheck stays enabled
 */
function initSpellCheckerEvents() {
  const editor = document.getElementById('editor');
  if (!editor || !currentSpellCheckLang) return;

  const spellcheckLang = languageToSpellcheck[currentSpellCheckLang] || currentSpellCheckLang;

  // Ensure spellcheck stays enabled on input
  editor.addEventListener('input', () => {
    // Always ensure spellcheck is enabled
    editor.setAttribute('spellcheck', 'true');
    editor.setAttribute('lang', spellcheckLang);
    editor.spellcheck = true;
    
    // Set lang on newly created paragraphs
    const paragraphs = editor.querySelectorAll('p:not([lang])');
    paragraphs.forEach(p => {
      p.setAttribute('spellcheck', 'true');
      p.setAttribute('lang', spellcheckLang);
      p.spellcheck = true;
    });
  });
  
  // Also ensure spellcheck on focus
  editor.addEventListener('focus', () => {
    editor.setAttribute('spellcheck', 'true');
    editor.setAttribute('lang', spellcheckLang);
    editor.spellcheck = true;
  });
  
  // Also handle when new paragraphs are created
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          if (node.tagName === 'P' || node.querySelector('p')) {
            const paragraphs = node.tagName === 'P' ? [node] : node.querySelectorAll('p');
            paragraphs.forEach(p => {
              if (!p.getAttribute('lang')) {
                p.setAttribute('spellcheck', 'true');
                p.setAttribute('lang', spellcheckLang);
                p.spellcheck = true;
              }
            });
          }
        }
      });
    });
  });
  
  observer.observe(editor, { childList: true, subtree: true });
  
  // Also watch for innerHTML changes via MutationObserver
  // This catches when innerHTML is set programmatically
  const contentObserver = new MutationObserver(() => {
    // Re-apply spellcheck to all paragraphs
    const paragraphs = editor.querySelectorAll('p');
    paragraphs.forEach(p => {
      if (!p.getAttribute('lang') || p.getAttribute('lang') !== spellcheckLang) {
        p.setAttribute('spellcheck', 'true');
        p.setAttribute('lang', spellcheckLang);
        p.spellcheck = true;
      }
    });
  });
  
  contentObserver.observe(editor, { 
    childList: true, 
    subtree: true,
    characterData: false,
    attributes: false
  });
}

// Export functions for use in popup.js
if (typeof window !== 'undefined') {
  window.spellChecker = {
    init: initSpellChecker,
    initEvents: initSpellCheckerEvents,
    checkWord: () => Promise.resolve({ correct: true, suggestions: [] }), // Not needed
    applySpellCheck: () => {}, // Chrome handles automatically
    setEnabled: (enabled) => {
      const editor = document.getElementById('editor');
      if (editor) {
        editor.setAttribute('spellcheck', enabled ? 'true' : 'false');
      }
    }
  };
}
