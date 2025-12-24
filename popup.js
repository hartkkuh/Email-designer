// Email Designer - Main Script

// ===========================================
// INTERNATIONALIZATION (i18n)
// ===========================================

// Current language - will be loaded from storage
let currentLang = 'en';

// Available languages
const availableLanguages = ['en', 'he', 'es', 'fr', 'de', 'ru', 'ar', 'pt', 'zh_CN'];

// RTL languages
const rtlLanguages = ['he', 'ar'];

// Translations cache (loaded from JSON files)
let translations = {};

// Load translations from JSON files
async function loadTranslations() {
  try {
    const loadPromises = availableLanguages.map(async (lang) => {
      const response = await fetch(chrome.runtime.getURL(`_locales/${lang}/messages.json`));
      translations[lang] = await response.json();
    });
    await Promise.all(loadPromises);
  } catch (e) {
    console.error('Failed to load translations:', e);
  }
}

// Get message - uses cached translations for manual language switching
function msg(key, substitutions) {
  // Try to get from our translations cache first
  if (translations[currentLang] && translations[currentLang][key]) {
    let message = translations[currentLang][key].message;
    // Handle substitutions
    if (substitutions && message) {
      if (Array.isArray(substitutions)) {
        substitutions.forEach((sub, i) => {
          message = message.replace(`$${i + 1}`, sub);
        });
      } else {
        message = message.replace('$1', substitutions);
      }
    }
    return message || key;
  }
  // Fallback to Chrome's i18n API
  return chrome.i18n.getMessage(key, substitutions) || key;
}

// Apply translations to the page
function applyI18n() {
  // Update elements with data-i18n attribute (text content)
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    el.textContent = msg(key);
  });
  
  // Update color icon letter based on language
  const currentColorIcon = document.getElementById('currentColorIcon');
  if (currentColorIcon && currentColorIcon.hasAttribute('data-i18n')) {
    const letterKey = currentColorIcon.getAttribute('data-i18n');
    const letter = msg(letterKey);
    if (letter) {
      // Preserve the current color
      const currentColor = currentColorIcon.style.color || '#000000';
      currentColorIcon.textContent = letter;
      currentColorIcon.style.color = currentColor;
    }
  }
  
  // Update elements with data-i18n-placeholder attribute
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    el.placeholder = msg(key);
  });
  
  // Update elements with data-i18n-title attribute (tooltips)
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    const key = el.getAttribute('data-i18n-title');
    el.title = msg(key);
  });
  
  // Update page title
  document.title = msg('appName');
  
  // Update font size select options
  const fontSizeSelect = document.getElementById('fontSize');
  if (fontSizeSelect) {
    const options = fontSizeSelect.querySelectorAll('option');
    const keys = ['fontSize', 'fontSizeVerySmall', 'fontSizeSmall', 'fontSizeNormal', 
                  'fontSizeMedium', 'fontSizeLarge', 'fontSizeVeryLarge', 'fontSizeHuge'];
    options.forEach((opt, i) => {
      if (keys[i]) opt.textContent = msg(keys[i]);
    });
  }
  
  // Update font family select
  const fontFamilySelect = document.getElementById('fontFamily');
  if (fontFamilySelect) {
    const firstOpt = fontFamilySelect.querySelector('option[disabled]');
    if (firstOpt) firstOpt.textContent = msg('fontFamily');
  }
  
  // Update language select
  updateLangSelect();
}

// Update language select to show current language
function updateLangSelect() {
  const langSelect = document.getElementById('langSelect');
  if (langSelect) {
    langSelect.value = currentLang;
  }
}

// Set language
function setLanguage(lang) {
  if (!availableLanguages.includes(lang)) {
    lang = 'en';
  }
  currentLang = lang;
  
  // Update document direction based on RTL languages
  document.documentElement.lang = currentLang;
  document.documentElement.dir = rtlLanguages.includes(currentLang) ? 'rtl' : 'ltr';
  
  // Apply translations
  applyI18n();
  
  // If a template is currently loaded, reload it in the new language
  if (currentTemplateName) {
    const template = getTemplate(currentTemplateName);
    if (template) {
      loadTemplateToEditor(template, currentTemplateName);
    }
  }
  
  // Save preference
  chrome.storage.local.set({ language: currentLang });
}

// Load saved language preference
async function loadLanguagePreference() {
  // First load translations
  await loadTranslations();
  
  // Then get saved preference
  chrome.storage.local.get(['language'], (result) => {
    if (result.language && availableLanguages.includes(result.language)) {
      currentLang = result.language;
    } else {
      // Auto-detect from browser
      const browserLang = navigator.language.split('-')[0];
      if (availableLanguages.includes(browserLang)) {
        currentLang = browserLang;
      } else if (navigator.language.startsWith('zh')) {
        currentLang = 'zh_CN';
      } else {
        currentLang = 'en';
      }
    }
    
    // Update document direction
    document.documentElement.lang = currentLang;
    document.documentElement.dir = rtlLanguages.includes(currentLang) ? 'rtl' : 'ltr';
    
    // Apply translations
    applyI18n();
  });
}

// Initialize language select
function initLanguageToggle() {
  const langSelect = document.getElementById('langSelect');
  if (langSelect) {
    langSelect.addEventListener('change', (e) => {
      setLanguage(e.target.value);
    });
  }
}

// ===========================================
// DOM Elements
// ===========================================

const editor = document.getElementById('editor');
const htmlEditor = document.getElementById('htmlEditor');
const previewFrame = document.getElementById('previewFrame');
const toolbar = document.getElementById('toolbar');
const tabs = document.querySelectorAll('.tab');
const tabContents = document.querySelectorAll('.tab-content');
const emailSubject = document.getElementById('emailSubject');

// Auto-save timer
let autoSaveTimer = null;

// Email background settings
let emailBgColor = '';
let emailBgImage = '';
let emailBgImageRepeat = 'no-repeat';
let emailBgImageSize = 'cover';

// Email document settings
let emailDirection = 'rtl'; // 'rtl' or 'ltr'
let emailLanguage = 'he'; // Language code (he, en, ar, etc.)

// Track currently loaded template
let currentTemplateName = null;

// Templates - Language-aware function
function getTemplate(templateName) {
  const lang = currentLang;
  const isRTL = rtlLanguages.includes(lang);
  const dir = isRTL ? 'rtl' : 'ltr';
  const fontFamily = isRTL ? "'Heebo', Arial, sans-serif" : "Arial, sans-serif";
  
  // Helper to get template translations
  const t = (key) => {
    const fullKey = `tpl${templateName.charAt(0).toUpperCase() + templateName.slice(1)}_${key}`;
    return msg(fullKey) || key;
  };
  
  // Template definitions with language-aware content
  const templates = {
  newsletter: `
<div style="max-width: 600px; margin: 0 auto; font-family: ${fontFamily}; direction: ${dir};">
  <div style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); padding: 40px 30px; text-align: center; border-radius: 12px 12px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 28px;">${msg('tplNewsletter_title')}</h1>
    <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0;">${msg('tplNewsletter_subtitle')}</p>
  </div>
  <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none;">
    <h2 style="color: #1f2937; font-size: 20px; margin-top: 0;">${msg('tplNewsletter_heading')}</h2>
    <p style="color: #4b5563; line-height: 1.8;">${msg('tplNewsletter_content')}</p>
    <a href="#" style="display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; margin-top: 15px;">${msg('tplNewsletter_readMore')}</a>
  </div>
  <div style="background: #f9fafb; padding: 20px 30px; text-align: center; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
    <p style="color: #6b7280; font-size: 13px; margin: 0;">© 2024 ${msg('tplNewsletter_yourName')}. ${msg('tplNewsletter_allRights')}</p>
  </div>
</div>`,
  invitation: `
<div style="max-width: 600px; margin: 0 auto; font-family: ${fontFamily}; direction: ${dir};">
  <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); padding: 40px 30px; text-align: center; border-radius: 12px; border: 2px solid #f59e0b;">
    <p style="color: #92400e; font-size: 14px; text-transform: uppercase; letter-spacing: 2px; margin: 0;">${msg('tplInvitation_special')}</p>
    <h1 style="color: #78350f; margin: 20px 0; font-size: 36px;">${msg('tplInvitation_title')}</h1>
    <div style="background: white; padding: 25px; border-radius: 8px; margin: 20px 0;">
      <p style="color: #92400e; font-size: 18px; margin: 0; line-height: 1.8;">
        <strong>${msg('tplInvitation_event')}:</strong> ${msg('tplInvitation_eventName')}<br>
        <strong>${msg('tplInvitation_date')}:</strong> ${msg('tplInvitation_dateValue')}<br>
        <strong>${msg('tplInvitation_time')}:</strong> ${msg('tplInvitation_timeValue')}<br>
        <strong>${msg('tplInvitation_location')}:</strong> ${msg('tplInvitation_locationValue')}
      </p>
    </div>
    <a href="#" style="display: inline-block; background: #f59e0b; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600;">${msg('tplInvitation_confirm')}</a>
    <p style="color: #92400e; font-size: 13px; margin-top: 20px;">${msg('tplInvitation_closing')}</p>
  </div>
</div>`,
  simple: `
<div style="max-width: 600px; margin: 0 auto; font-family: ${fontFamily}; direction: ${dir}; padding: 20px;">
  <p style="color: #374151; font-size: 16px; line-height: 1.8;">${msg('tplSimple_greeting')}</p>
  <p style="color: #374151; font-size: 16px; line-height: 1.8;">${msg('tplSimple_content')}</p>
  <p style="color: #374151; font-size: 16px; line-height: 1.8;">${msg('tplSimple_closing')}<br><strong>${msg('tplSimple_yourName')}</strong></p>
</div>`,
  promo: `
<div style="max-width: 600px; margin: 0 auto; font-family: ${fontFamily}; direction: ${dir};">
  <div style="background: linear-gradient(135deg, #ec4899 0%, #be185d 100%); padding: 40px 30px; text-align: center; border-radius: 12px 12px 0 0;">
    <p style="color: rgba(255,255,255,0.9); font-size: 14px; margin: 0;">🔥 ${msg('tplPromo_special')}</p>
    <h1 style="color: white; margin: 15px 0; font-size: 42px;">${msg('tplPromo_discount')}</h1>
    <p style="color: rgba(255,255,255,0.9); font-size: 18px; margin: 0;">${msg('tplPromo_limited')}</p>
  </div>
  <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none;">
    <h2 style="color: #1f2937; font-size: 20px; margin-top: 0; text-align: center;">${msg('tplPromo_heading')}</h2>
    <p style="color: #4b5563; line-height: 1.8; text-align: center;">${msg('tplPromo_content')}</p>
    <div style="text-align: center; margin-top: 20px;">
      <a href="#" style="display: inline-block; background: #ec4899; color: white; padding: 16px 40px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 18px;">${msg('tplPromo_buyNow')}</a>
    </div>
  </div>
  <div style="background: #fdf2f8; padding: 15px 30px; text-align: center; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
    <p style="color: #9d174d; font-size: 12px; margin: 0;">*${msg('tplPromo_terms')}</p>
  </div>
</div>`,
  welcome: `
<div style="max-width: 600px; margin: 0 auto; font-family: ${fontFamily}; direction: ${dir};">
  <div style="background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%); padding: 50px 30px; text-align: center; border-radius: 12px 12px 0 0;">
    <div style="font-size: 60px; margin-bottom: 20px;">👋</div>
    <h1 style="color: white; margin: 0; font-size: 32px;">${msg('tplWelcome_title')}</h1>
    <p style="color: rgba(255,255,255,0.9); font-size: 18px; margin: 15px 0 0;">${msg('tplWelcome_subtitle')}</p>
  </div>
  <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none;">
    <p style="color: #4b5563; font-size: 16px; line-height: 1.8;">${msg('tplWelcome_greeting')}</p>
    <p style="color: #4b5563; font-size: 16px; line-height: 1.8;">${msg('tplWelcome_content')}</p>
    <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <h3 style="color: #1f2937; margin: 0 0 10px;">${msg('tplWelcome_nextSteps')}</h3>
      <ul style="color: #4b5563; margin: 0; ${isRTL ? 'padding-right' : 'padding-left'}: 20px; line-height: 2;">
        <li>${msg('tplWelcome_step1')}</li>
        <li>${msg('tplWelcome_step2')}</li>
        <li>${msg('tplWelcome_step3')}</li>
      </ul>
    </div>
    <div style="text-align: center;">
      <a href="#" style="display: inline-block; background: #8b5cf6; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600;">${msg('tplWelcome_getStarted')}</a>
    </div>
  </div>
  <div style="background: #f9fafb; padding: 20px 30px; text-align: center; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
    <p style="color: #6b7280; font-size: 13px; margin: 0;">${msg('tplWelcome_questions')}</p>
  </div>
</div>`,
  reminder: `
<div style="max-width: 600px; margin: 0 auto; font-family: ${fontFamily}; direction: ${dir};">
  <div style="background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); padding: 30px; border-radius: 12px 12px 0 0;">
    <div style="display: flex; align-items: center; justify-content: center; gap: 15px;">
      <span style="font-size: 40px;">⏰</span>
      <h1 style="color: white; margin: 0; font-size: 28px;">${msg('tplReminder_title')}</h1>
    </div>
  </div>
  <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
    <div style="background: #fff7ed; padding: 20px; border-radius: 8px; ${isRTL ? 'border-right' : 'border-left'}: 4px solid #f97316; margin-bottom: 20px;">
      <h3 style="color: #c2410c; margin: 0 0 10px;">${msg('tplReminder_dontForget')}</h3>
      <p style="color: #9a3412; margin: 0; line-height: 1.6;">${msg('tplReminder_meeting')}<br><strong>${msg('tplReminder_dateTime')}</strong></p>
    </div>
    <p style="color: #4b5563; line-height: 1.8;">${msg('tplReminder_confirm')}</p>
    <div style="text-align: center; margin-top: 20px;">
      <a href="#" style="display: inline-block; background: #f97316; color: white; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-weight: 500; margin: 0 5px;">${msg('tplReminder_confirmBtn')}</a>
      <a href="#" style="display: inline-block; background: #e5e7eb; color: #374151; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-weight: 500; margin: 0 5px;">${msg('tplReminder_reschedule')}</a>
    </div>
  </div>
</div>`,
  alert: `
<div style="max-width: 600px; margin: 0 auto; font-family: ${fontFamily}; direction: ${dir};">
  <div style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); padding: 30px; border-radius: 12px;">
    <div style="text-align: center;">
      <span style="font-size: 50px;">⚠️</span>
      <h1 style="color: white; margin: 15px 0; font-size: 28px;">${msg('tplAlert_title')}</h1>
      <p style="color: rgba(255,255,255,0.95); font-size: 16px; line-height: 1.8; margin: 0;">${msg('tplAlert_message')}</p>
      <div style="background: rgba(255,255,255,0.15); padding: 15px; border-radius: 8px; margin: 20px 0;">
        <p style="color: white; margin: 0; font-weight: 600;">${msg('tplAlert_deadline')}</p>
      </div>
      <a href="#" style="display: inline-block; background: white; color: #dc2626; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600;">${msg('tplAlert_action')}</a>
    </div>
  </div>
</div>`,
  birthday: `
<div style="max-width: 600px; margin: 0 auto; font-family: ${fontFamily}; direction: ${dir};">
  <div style="background: linear-gradient(135deg, #f472b6 0%, #db2777 50%, #9333ea 100%); padding: 50px 30px; text-align: center; border-radius: 12px;">
    <div style="font-size: 70px; margin-bottom: 15px;">🎂</div>
    <h1 style="color: white; margin: 0; font-size: 36px;">${msg('tplBirthday_title')}</h1>
    <p style="color: rgba(255,255,255,0.95); font-size: 20px; margin: 20px 0; line-height: 1.6;">${msg('tplBirthday_message')}</p>
    <div style="font-size: 40px; margin: 20px 0;">🎈🎁🎉</div>
    <p style="color: rgba(255,255,255,0.9); font-size: 16px; margin: 0;">${msg('tplBirthday_closing')}</p>
  </div>
</div>`,
  job: `
<div style="max-width: 600px; margin: 0 auto; font-family: ${fontFamily}; direction: ${dir};">
  <div style="background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%); padding: 40px 30px; text-align: center; border-radius: 12px 12px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 28px;">🚀 ${msg('tplJob_title')}</h1>
    <p style="color: rgba(255,255,255,0.9); font-size: 16px; margin: 15px 0 0;">${msg('tplJob_subtitle')}</p>
  </div>
  <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none;">
    <h2 style="color: #0369a1; font-size: 22px; margin-top: 0;">${msg('tplJob_position')}</h2>
    <div style="background: #f0f9ff; padding: 15px; border-radius: 8px; margin: 20px 0;">
      <p style="color: #0c4a6e; margin: 0;">📍 ${msg('tplJob_location')}: ${msg('tplJob_locationValue')} | ⏰ ${msg('tplJob_scope')}: ${msg('tplJob_scopeValue')} | 💰 ${msg('tplJob_salary')}: ${msg('tplJob_salaryValue')}</p>
    </div>
    <h3 style="color: #1e293b; font-size: 16px;">${msg('tplJob_requirements')}</h3>
    <ul style="color: #475569; line-height: 2; ${isRTL ? 'padding-right' : 'padding-left'}: 20px;">
      <li>${msg('tplJob_req1')}</li>
      <li>${msg('tplJob_req2')}</li>
      <li>${msg('tplJob_req3')}</li>
    </ul>
    <h3 style="color: #1e293b; font-size: 16px;">${msg('tplJob_offers')}</h3>
    <ul style="color: #475569; line-height: 2; ${isRTL ? 'padding-right' : 'padding-left'}: 20px;">
      <li>${msg('tplJob_offer1')}</li>
      <li>${msg('tplJob_offer2')}</li>
      <li>${msg('tplJob_offer3')}</li>
    </ul>
    <div style="text-align: center; margin-top: 25px;">
      <a href="#" style="display: inline-block; background: #0ea5e9; color: white; padding: 14px 40px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">${msg('tplJob_apply')}</a>
    </div>
  </div>
</div>`,
  survey: `
<div style="max-width: 600px; margin: 0 auto; font-family: ${fontFamily}; direction: ${dir};">
  <div style="background: linear-gradient(135deg, #a855f7 0%, #7c3aed 100%); padding: 40px 30px; text-align: center; border-radius: 12px 12px 0 0;">
    <span style="font-size: 50px;">📋</span>
    <h1 style="color: white; margin: 15px 0 0; font-size: 28px;">${msg('tplSurvey_title')}</h1>
    <p style="color: rgba(255,255,255,0.9); font-size: 16px; margin: 10px 0 0;">${msg('tplSurvey_subtitle')}</p>
  </div>
  <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
    <p style="color: #4b5563; font-size: 16px; line-height: 1.8; text-align: center;">${msg('tplSurvey_content')}</p>
    <div style="background: #faf5ff; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
      <p style="color: #6b21a8; margin: 0 0 10px; font-size: 14px;">⏱️ ${msg('tplSurvey_time')}</p>
      <p style="color: #6b21a8; margin: 0; font-size: 14px;">🎁 ${msg('tplSurvey_reward')}</p>
    </div>
    <div style="text-align: center;">
      <a href="#" style="display: inline-block; background: #a855f7; color: white; padding: 16px 50px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 18px;">${msg('tplSurvey_button')}</a>
    </div>
    <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 20px 0 0;">*${msg('tplSurvey_terms')}</p>
  </div>
</div>`,
  receipt: `
<div style="max-width: 600px; margin: 0 auto; font-family: ${fontFamily}; direction: ${dir};">
  <div style="background: #1f2937; padding: 30px; border-radius: 12px 12px 0 0;">
    <div style="display: flex; justify-content: space-between; align-items: center;">
      <h1 style="color: white; margin: 0; font-size: 24px;">${msg('tplReceipt_title')}</h1>
      <span style="color: #10b981; font-size: 14px; background: rgba(16,185,129,0.15); padding: 6px 12px; border-radius: 20px;">${msg('tplReceipt_paid')} ✓</span>
    </div>
    <p style="color: #9ca3af; margin: 10px 0 0;">${msg('tplReceipt_orderNumber')}: #12345678</p>
  </div>
  <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none;">
    <table style="width: 100%; border-collapse: collapse;">
      <tr style="border-bottom: 1px solid #e5e7eb;">
        <th style="text-align: ${isRTL ? 'right' : 'left'}; padding: 12px 0; color: #6b7280; font-weight: 500;">${msg('tplReceipt_item')}</th>
        <th style="text-align: center; padding: 12px 0; color: #6b7280; font-weight: 500;">${msg('tplReceipt_quantity')}</th>
        <th style="text-align: ${isRTL ? 'left' : 'right'}; padding: 12px 0; color: #6b7280; font-weight: 500;">${msg('tplReceipt_price')}</th>
      </tr>
      <tr style="border-bottom: 1px solid #e5e7eb;">
        <td style="padding: 15px 0; color: #1f2937;">${msg('tplReceipt_product1')}</td>
        <td style="padding: 15px 0; color: #6b7280; text-align: center;">1</td>
        <td style="padding: 15px 0; color: #1f2937; text-align: ${isRTL ? 'left' : 'right'};">${msg('tplReceipt_price1')}</td>
      </tr>
      <tr style="border-bottom: 1px solid #e5e7eb;">
        <td style="padding: 15px 0; color: #1f2937;">${msg('tplReceipt_product2')}</td>
        <td style="padding: 15px 0; color: #6b7280; text-align: center;">2</td>
        <td style="padding: 15px 0; color: #1f2937; text-align: ${isRTL ? 'left' : 'right'};">${msg('tplReceipt_price2')}</td>
      </tr>
    </table>
    <div style="border-top: 2px solid #e5e7eb; margin-top: 15px; padding-top: 15px;">
      <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
        <span style="color: #6b7280;">${msg('tplReceipt_subtotal')}</span>
        <span style="color: #1f2937;">${msg('tplReceipt_subtotalValue')}</span>
      </div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
        <span style="color: #6b7280;">${msg('tplReceipt_shipping')}</span>
        <span style="color: #1f2937;">${msg('tplReceipt_shippingValue')}</span>
      </div>
      <div style="display: flex; justify-content: space-between; font-size: 18px; font-weight: 600;">
        <span style="color: #1f2937;">${msg('tplReceipt_total')}</span>
        <span style="color: #1f2937;">${msg('tplReceipt_totalValue')}</span>
      </div>
    </div>
  </div>
  <div style="background: #f9fafb; padding: 20px 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
    <p style="color: #6b7280; font-size: 13px; margin: 0; text-align: center;">${msg('tplReceipt_contact')}</p>
  </div>
</div>`,
  social: `
<div style="max-width: 600px; margin: 0 auto; font-family: ${fontFamily}; direction: ${dir};">
  <div style="background: linear-gradient(135deg, #ec4899 0%, #f43f5e 50%, #f97316 100%); padding: 40px 30px; text-align: center; border-radius: 12px 12px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 28px;">${msg('tplSocial_title')}</h1>
    <p style="color: rgba(255,255,255,0.9); font-size: 16px; margin: 15px 0 0;">${msg('tplSocial_subtitle')}</p>
  </div>
  <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; text-align: center;">
    <p style="color: #4b5563; font-size: 16px; line-height: 1.8; margin-bottom: 25px;">${msg('tplSocial_content')}</p>
    <div style="margin: 25px 0;">
      <a href="#" style="display: inline-block; background: #1877F2; color: white; padding: 12px 20px; border-radius: 8px; text-decoration: none; margin: 5px;">Facebook</a>
      <a href="#" style="display: inline-block; background: #1DA1F2; color: white; padding: 12px 20px; border-radius: 8px; text-decoration: none; margin: 5px;">Twitter</a>
      <a href="#" style="display: inline-block; background: linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888); color: white; padding: 12px 20px; border-radius: 8px; text-decoration: none; margin: 5px;">Instagram</a>
      <a href="#" style="display: inline-block; background: #0A66C2; color: white; padding: 12px 20px; border-radius: 8px; text-decoration: none; margin: 5px;">LinkedIn</a>
      <a href="#" style="display: inline-block; background: #FF0000; color: white; padding: 12px 20px; border-radius: 8px; text-decoration: none; margin: 5px;">YouTube</a>
    </div>
    <p style="color: #9ca3af; font-size: 14px;">${msg('tplSocial_followers')}</p>
  </div>
  <div style="background: #f9fafb; padding: 20px 30px; text-align: center; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
    <p style="color: #6b7280; font-size: 13px; margin: 0;">${msg('tplSocial_share')}</p>
  </div>
</div>`,
  webinar: `
<div style="max-width: 600px; margin: 0 auto; font-family: ${fontFamily}; direction: ${dir};">
  <div style="background: linear-gradient(135deg, #0891b2 0%, #0e7490 100%); padding: 40px 30px; text-align: center; border-radius: 12px 12px 0 0;">
    <span style="background: #fbbf24; color: #0e7490; padding: 6px 15px; border-radius: 20px; font-size: 12px; font-weight: 600;">${msg('tplWebinar_free')}</span>
    <h1 style="color: white; margin: 20px 0 10px; font-size: 28px;">${msg('tplWebinar_title')}</h1>
    <p style="color: rgba(255,255,255,0.9); font-size: 16px; margin: 0;">${msg('tplWebinar_subtitle')}</p>
  </div>
  <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none;">
    <div style="display: flex; flex-wrap: wrap; gap: 15px; margin-bottom: 25px;">
      <div style="flex: 1; min-width: 140px; background: #ecfeff; padding: 15px; border-radius: 8px; text-align: center;">
        <span style="font-size: 24px;">📅</span>
        <p style="color: #0e7490; margin: 8px 0 0; font-weight: 600;">${msg('tplWebinar_day')}</p>
        <p style="color: #0e7490; margin: 5px 0 0; font-size: 14px;">${msg('tplWebinar_date')}</p>
      </div>
      <div style="flex: 1; min-width: 140px; background: #ecfeff; padding: 15px; border-radius: 8px; text-align: center;">
        <span style="font-size: 24px;">⏰</span>
        <p style="color: #0e7490; margin: 8px 0 0; font-weight: 600;">${msg('tplWebinar_time')}</p>
        <p style="color: #0e7490; margin: 5px 0 0; font-size: 14px;">${msg('tplWebinar_timezone')}</p>
      </div>
    </div>
    <h3 style="color: #1f2937; font-size: 16px;">${msg('tplWebinar_learn')}</h3>
    <ul style="color: #4b5563; line-height: 2; ${isRTL ? 'padding-right' : 'padding-left'}: 20px;">
      <li>${msg('tplWebinar_topic1')}</li>
      <li>${msg('tplWebinar_topic2')}</li>
      <li>${msg('tplWebinar_topic3')}</li>
    </ul>
    <div style="text-align: center; margin-top: 25px;">
      <a href="#" style="display: inline-block; background: #0891b2; color: white; padding: 16px 50px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 18px;">${msg('tplWebinar_register')}</a>
    </div>
    <p style="color: #9ca3af; font-size: 13px; text-align: center; margin-top: 15px;">${msg('tplWebinar_limited')}</p>
  </div>
</div>`,
  event: `
<div style="max-width: 600px; margin: 0 auto; font-family: ${fontFamily}; direction: ${dir};">
  <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 50px 30px; text-align: center; border-radius: 12px 12px 0 0; position: relative;">
    <div style="position: absolute; ${isRTL ? 'right' : 'left'}: 20px; top: 20px; background: #fbbf24; color: #1a1a2e; padding: 6px 15px; border-radius: 20px; font-size: 12px; font-weight: 600;">VIP</div>
    <div style="font-size: 50px; margin-bottom: 15px;">🎪</div>
    <h1 style="color: #fbbf24; margin: 0; font-size: 32px;">${msg('tplEvent_title')}</h1>
    <p style="color: rgba(255,255,255,0.9); font-size: 18px; margin: 15px 0 0;">${msg('tplEvent_subtitle')}</p>
  </div>
  <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none;">
    <div style="background: #fef3c7; padding: 20px; border-radius: 8px; margin-bottom: 20px; ${isRTL ? 'border-right' : 'border-left'}: 4px solid #fbbf24;">
      <p style="color: #92400e; margin: 0; line-height: 1.8;">
        <strong>📍 ${msg('tplEvent_location')}:</strong> ${msg('tplEvent_locationValue')}<br>
        <strong>📅 ${msg('tplEvent_date')}:</strong> ${msg('tplEvent_dateValue')}<br>
        <strong>⏰ ${msg('tplEvent_time')}:</strong> ${msg('tplEvent_timeValue')}
      </p>
    </div>
    <p style="color: #4b5563; line-height: 1.8; text-align: center;">${msg('tplEvent_content')}</p>
    <div style="text-align: center; margin-top: 25px;">
      <a href="#" style="display: inline-block; background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%); color: #1a1a2e; padding: 16px 40px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">${msg('tplEvent_reserve')}</a>
    </div>
  </div>
  <div style="background: #1a1a2e; padding: 15px 30px; text-align: center; border-radius: 0 0 12px 12px;">
    <p style="color: #fbbf24; font-size: 13px; margin: 0;">${msg('tplEvent_limited')}</p>
  </div>
</div>`,
  shipping: `
<div style="max-width: 600px; margin: 0 auto; font-family: ${fontFamily}; direction: ${dir};">
  <div style="background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); padding: 30px; border-radius: 12px 12px 0 0;">
    <div style="display: flex; align-items: center; justify-content: center; gap: 15px;">
      <span style="font-size: 40px;">📦</span>
      <div>
        <h1 style="color: white; margin: 0; font-size: 24px;">${msg('tplShipping_title')}</h1>
        <p style="color: rgba(255,255,255,0.9); margin: 5px 0 0; font-size: 14px;">${msg('tplShipping_tracking')}: #TRK123456789</p>
      </div>
    </div>
  </div>
  <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none;">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px;">
      <div style="text-align: center; flex: 1;">
        <div style="width: 30px; height: 30px; background: #22c55e; border-radius: 50%; margin: 0 auto 8px; display: flex; align-items: center; justify-content: center; color: white;">✓</div>
        <p style="color: #22c55e; font-size: 12px; margin: 0;">${msg('tplShipping_ordered')}</p>
      </div>
      <div style="flex: 1; height: 2px; background: #22c55e;"></div>
      <div style="text-align: center; flex: 1;">
        <div style="width: 30px; height: 30px; background: #22c55e; border-radius: 50%; margin: 0 auto 8px; display: flex; align-items: center; justify-content: center; color: white;">✓</div>
        <p style="color: #22c55e; font-size: 12px; margin: 0;">${msg('tplShipping_packed')}</p>
      </div>
      <div style="flex: 1; height: 2px; background: #22c55e;"></div>
      <div style="text-align: center; flex: 1;">
        <div style="width: 30px; height: 30px; background: #fbbf24; border-radius: 50%; margin: 0 auto 8px; display: flex; align-items: center; justify-content: center;">🚚</div>
        <p style="color: #fbbf24; font-size: 12px; margin: 0; font-weight: 600;">${msg('tplShipping_shipping')}</p>
      </div>
      <div style="flex: 1; height: 2px; background: #e5e7eb;"></div>
      <div style="text-align: center; flex: 1;">
        <div style="width: 30px; height: 30px; background: #e5e7eb; border-radius: 50%; margin: 0 auto 8px;"></div>
        <p style="color: #9ca3af; font-size: 12px; margin: 0;">${msg('tplShipping_delivered')}</p>
      </div>
    </div>
    <div style="background: #f0fdf4; padding: 15px; border-radius: 8px;">
      <p style="color: #166534; margin: 0; font-size: 14px;"><strong>${msg('tplShipping_eta')}</strong> ${msg('tplShipping_etaValue')}</p>
    </div>
    <div style="text-align: center; margin-top: 20px;">
      <a href="#" style="display: inline-block; background: #22c55e; color: white; padding: 12px 30px; border-radius: 6px; text-decoration: none; font-weight: 500;">${msg('tplShipping_track')}</a>
    </div>
  </div>
</div>`,
  referral: `
<div style="max-width: 600px; margin: 0 auto; font-family: ${fontFamily}; direction: ${dir};">
  <div style="background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); padding: 40px 30px; text-align: center; border-radius: 12px 12px 0 0;">
    <div style="font-size: 50px; margin-bottom: 15px;">🎁</div>
    <h1 style="color: white; margin: 0; font-size: 28px;">${msg('tplReferral_title')}</h1>
    <p style="color: rgba(255,255,255,0.9); font-size: 16px; margin: 15px 0 0;">${msg('tplReferral_subtitle')}</p>
  </div>
  <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none;">
    <div style="background: #fff7ed; border: 2px dashed #f97316; padding: 20px; border-radius: 8px; text-align: center; margin-bottom: 20px;">
      <p style="color: #9a3412; margin: 0 0 10px; font-size: 14px;">${msg('tplReferral_yourCode')}</p>
      <p style="color: #ea580c; font-size: 28px; font-weight: 700; margin: 0; letter-spacing: 3px;">FRIEND50</p>
    </div>
    <div style="display: flex; gap: 15px; margin-bottom: 20px;">
      <div style="flex: 1; background: #fef3c7; padding: 15px; border-radius: 8px; text-align: center;">
        <p style="color: #92400e; font-size: 24px; font-weight: 700; margin: 0;">${msg('tplReferral_amount')}</p>
        <p style="color: #92400e; font-size: 12px; margin: 5px 0 0;">${msg('tplReferral_forYou')}</p>
      </div>
      <div style="flex: 1; background: #fef3c7; padding: 15px; border-radius: 8px; text-align: center;">
        <p style="color: #92400e; font-size: 24px; font-weight: 700; margin: 0;">${msg('tplReferral_amount')}</p>
        <p style="color: #92400e; font-size: 12px; margin: 5px 0 0;">${msg('tplReferral_forFriends')}</p>
      </div>
    </div>
    <p style="color: #4b5563; line-height: 1.8; text-align: center;">${msg('tplReferral_description')}</p>
    <div style="text-align: center; margin-top: 20px;">
      <a href="#" style="display: inline-block; background: #f97316; color: white; padding: 14px 40px; border-radius: 8px; text-decoration: none; font-weight: 600;">${msg('tplReferral_share')}</a>
    </div>
  </div>
  <div style="background: #fff7ed; padding: 15px 30px; text-align: center; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
    <p style="color: #9a3412; font-size: 13px; margin: 0;">${msg('tplReferral_stats')}</p>
  </div>
</div>`
  };
  
  return templates[templateName] || null;
}

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  // Load and apply internationalization first
  await loadLanguagePreference();
  initLanguageToggle();
  
  initTabs();
  initToolbar();
  initColorPickers();
  initColorSwatches();
  initDirectionToggle();
  initLanguageSelector();
  initModals();
  initTemplates();
  initFooterActions();
  initEditorSync();
  initNewTools();
  initAdvancedToggle();
  loadSavedContent();
  initAutoSave();
  
  // New features
  initThemeToggle();
  initEmojiPicker();
  initPreviewModes();
  initWordCounter();
  initQrCode();
  initMapModal();
  initSocialButtons();
  initSignatureManager();
  initAdvancedTableEditor();
  initAIFeatures();
  initVariables();
  initShortcutsHelp();
});

// Tab Navigation
function initTabs() {
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const tabId = tab.dataset.tab;
      const previousTab = document.querySelector('.tab.active');
      const previousTabId = previousTab ? previousTab.dataset.tab : 'visual';
      
      // Update active tab
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      // Update content
      tabContents.forEach(content => {
        content.classList.remove('active');
        if (content.id === `${tabId}-content`) {
          content.classList.add('active');
        }
      });
      
      // Show/hide toolbar and subject
      const showToolbar = (tabId === 'visual');
      toolbar.style.display = showToolbar ? 'flex' : 'none';
      const subjectWrapper = document.getElementById('subjectWrapper');
      if (subjectWrapper) {
        subjectWrapper.style.display = (tabId === 'visual' || tabId === 'html') ? 'flex' : 'none';
      }
      
      // Sync content between editors
      if (tabId === 'html') {
        // Moving TO html - show only body content (not full HTML document)
        // The full HTML structure is maintained in the background via getFullHtml()
        htmlEditor.value = editor.innerHTML;
      } else if (tabId === 'visual') {
        // Moving TO visual - copy from html editor (if coming from html)
        if (previousTabId === 'html') {
          // User edited only the body content in HTML editor
          editor.innerHTML = htmlEditor.value;
        }
      } else if (tabId === 'preview') {
        // Update preview with current content
        if (previousTabId === 'html') {
          // Sync HTML editor changes to visual editor before preview
          editor.innerHTML = htmlEditor.value;
        }
        updatePreview();
      }
    });
  });
}

// Toolbar Commands
function initToolbar() {
  // Basic formatting buttons
  toolbar.querySelectorAll('[data-command]').forEach(btn => {
    btn.addEventListener('click', () => {
      const command = btn.dataset.command;
      document.execCommand(command, false, null);
      editor.focus();
    });
  });
  
  // Font family
  const fontFamily = document.getElementById('fontFamily');
  if (fontFamily) {
    fontFamily.addEventListener('change', (e) => {
      if (e.target.value) {
        document.execCommand('fontName', false, e.target.value);
        editor.focus();
        // Reset to placeholder so same option can be selected again
        setTimeout(() => { e.target.selectedIndex = 0; }, 100);
      }
    });
  }
  
  // Font size
  const fontSize = document.getElementById('fontSize');
  if (fontSize) {
    fontSize.addEventListener('change', (e) => {
      if (e.target.value) {
        document.execCommand('fontSize', false, e.target.value);
        editor.focus();
        // Reset to placeholder so same option can be selected again
        setTimeout(() => { e.target.selectedIndex = 0; }, 100);
      }
    });
  }
  
  // Insert link
  const insertLink = document.getElementById('insertLink');
  if (insertLink) {
    insertLink.addEventListener('click', () => {
      saveSelection(); // Save cursor position before opening modal
      openModal('linkModal');
    });
  }
  
  // Insert image
  const insertImage = document.getElementById('insertImage');
  if (insertImage) {
    insertImage.addEventListener('click', () => {
      saveSelection(); // Save cursor position before opening modal
      openModal('imageModal');
    });
  }
  
  // Insert table
  const insertTable = document.getElementById('insertTable');
  if (insertTable) {
    insertTable.addEventListener('click', () => {
      saveSelection(); // Save cursor position before opening modal
      openModal('tableModal');
    });
  }
  
  // Insert divider
  const insertDivider = document.getElementById('insertDivider');
  if (insertDivider) {
    insertDivider.addEventListener('click', () => {
      document.execCommand('insertHTML', false, '<hr style="border: none; height: 2px; background: #e5e7eb; margin: 20px 0;">');
      editor.focus();
    });
  }
}

// Color Pickers - Now handled in initColorSwatches
function initColorPickers() {
  // Legacy function - color pickers are now part of the dropdown menus
}

// Note: File uploads removed - now using URL links only for images, videos, and files

// Modals
function initModals() {
  // Link Modal
  document.getElementById('confirmLink').addEventListener('click', () => {
    const text = document.getElementById('linkText').value;
    const url = document.getElementById('linkUrl').value;
    
    if (url) {
      // Restore selection and focus editor
      editor.focus();
      restoreSelection();
      const linkHtml = `<a href="${url}" style="color: #3b82f6; text-decoration: underline;">${text || url}</a>`;
      document.execCommand('insertHTML', false, linkHtml);
      closeModal('linkModal');
      clearModalInputs('linkModal');
    }
  });
  
  document.getElementById('cancelLink').addEventListener('click', () => {
    closeModal('linkModal');
    clearModalInputs('linkModal');
  });
  
  // Image Modal - with file upload support
  initImageModal();
  
  // Video Modal
  initVideoModal();
  
  // Email Background Image Modal
  initEmailBgImageModal();
  
  // File Modal
  initFileModal();
  
  // Table Modal
  document.getElementById('confirmTable').addEventListener('click', () => {
    const rows = parseInt(document.getElementById('tableRows').value) || 3;
    const cols = parseInt(document.getElementById('tableCols').value) || 3;
    
    let tableHtml = '<table style="border-collapse: collapse; width: 100%; margin: 15px 0;">';
    
    // Header row
    tableHtml += '<tr>';
    for (let j = 0; j < cols; j++) {
      tableHtml += '<th style="border: 1px solid #e5e7eb; padding: 10px; background: #f9fafb; text-align: right;">כותרת</th>';
    }
    tableHtml += '</tr>';
    
    // Data rows
    for (let i = 1; i < rows; i++) {
      tableHtml += '<tr>';
      for (let j = 0; j < cols; j++) {
        tableHtml += '<td style="border: 1px solid #e5e7eb; padding: 10px; text-align: right;">תוכן</td>';
      }
      tableHtml += '</tr>';
    }
    
    tableHtml += '</table>';
    
    // Restore selection and focus editor
    editor.focus();
    restoreSelection();
    document.execCommand('insertHTML', false, tableHtml);
    closeModal('tableModal');
  });
  
  document.getElementById('cancelTable').addEventListener('click', () => {
    closeModal('tableModal');
  });
  
  // Close modals on outside click
  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.remove('active');
        resetImageModal();
        resetVideoModal();
        resetFileModal();
      }
    });
  });
}

// Image Modal Initialization
function initImageModal() {
  const modal = document.getElementById('imageModal');
  if (!modal) return;
  
  // Confirm image - URL only
  document.getElementById('confirmImage').addEventListener('click', () => {
    const imgSrc = document.getElementById('imageUrl').value;
    const alt = document.getElementById('imageAlt').value;
    const width = document.getElementById('imageWidth').value;
    
    if (imgSrc) {
      // Restore selection and focus editor
      editor.focus();
      restoreSelection();
      const widthAttr = width ? `width="${width}"` : 'style="max-width: 100%;"';
      const imgHtml = `<img src="${imgSrc}" alt="${alt}" ${widthAttr}>`;
      document.execCommand('insertHTML', false, imgHtml);
      closeModal('imageModal');
      clearModalInputs('imageModal');
    } else {
      showToast('יש להזין כתובת URL לתמונה', 'error');
    }
  });
  
  document.getElementById('cancelImage').addEventListener('click', () => {
    closeModal('imageModal');
    clearModalInputs('imageModal');
  });
}

function resetImageModal() {
  clearModalInputs('imageModal');
}

// Email Background Image Modal
function initEmailBgImageModal() {
  const modal = document.getElementById('emailBgImageModal');
  if (!modal) return;
  
  const emailBgImageBtn = document.getElementById('emailBgImageBtn');
  const confirmBtn = document.getElementById('confirmEmailBgImage');
  const cancelBtn = document.getElementById('cancelEmailBgImage');
  const removeBtn = document.getElementById('removeEmailBgImage');
  const urlInput = document.getElementById('emailBgImageUrl');
  const sizeSelect = document.getElementById('emailBgImageSize');
  
  if (emailBgImageBtn) {
    emailBgImageBtn.addEventListener('click', () => {
      // Load current values
      if (urlInput) urlInput.value = emailBgImage || '';
      if (sizeSelect) sizeSelect.value = emailBgImageSize;
      openModal('emailBgImageModal');
    });
  }
  
  if (confirmBtn) {
    confirmBtn.addEventListener('click', () => {
      if (urlInput && urlInput.value.trim()) {
        emailBgImage = urlInput.value.trim();
        emailBgImageRepeat = 'no-repeat'; // Always no-repeat
        emailBgImageSize = sizeSelect ? sizeSelect.value : 'cover';
        updatePreview();
        saveContent(); // Save background image change
        showToast('תמונת רקע נוספה', 'success');
      } else {
        showToast('יש להזין כתובת תמונה', 'error');
        return;
      }
      closeModal('emailBgImageModal');
    });
  }
  
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      closeModal('emailBgImageModal');
    });
  }
  
  if (removeBtn) {
    removeBtn.addEventListener('click', () => {
      emailBgImage = '';
      emailBgImageRepeat = 'no-repeat';
      emailBgImageSize = 'cover';
      if (urlInput) urlInput.value = '';
      updatePreview();
      saveContent(); // Save background image removal
      showToast('תמונת רקע הוסרה', 'success');
      closeModal('emailBgImageModal');
    });
  }
}

// Video Modal Initialization
function initVideoModal() {
  const modal = document.getElementById('videoModal');
  if (!modal) return;
  
  const tabs = modal.querySelectorAll('.modal-tab');
  const urlSection = document.getElementById('videoUrlSection');
  const embedSection = document.getElementById('videoEmbedSection');
  
  // Tab switching (embed and url only)
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      const source = tab.dataset.source;
      urlSection.classList.toggle('hidden', source !== 'url');
      embedSection.classList.toggle('hidden', source !== 'embed');
    });
  });
  
  // Confirm video - URL or embed only
  document.getElementById('confirmVideo').addEventListener('click', () => {
    const activeTab = modal.querySelector('.modal-tab.active');
    const source = activeTab.dataset.source;
    const width = document.getElementById('videoWidth').value || 560;
    
    let videoHtml = '';
    
    if (source === 'url') {
      const url = document.getElementById('videoUrl').value;
      if (url) {
        videoHtml = `<video src="${url}" width="${width}" controls style="max-width: 100%; border-radius: 8px;"></video>`;
      }
    } else if (source === 'embed') {
      const embedUrl = document.getElementById('videoEmbed').value;
      const embedCode = convertToEmbed(embedUrl, width);
      if (embedCode) {
        videoHtml = embedCode;
      }
    }
    
    if (videoHtml) {
      // Restore selection and focus editor
      editor.focus();
      restoreSelection();
      document.execCommand('insertHTML', false, videoHtml);
      closeModal('videoModal');
      resetVideoModal();
    } else {
      showToast('יש להזין קישור YouTube/Vimeo או כתובת URL', 'error');
    }
  });
  
  document.getElementById('cancelVideo').addEventListener('click', () => {
    closeModal('videoModal');
    resetVideoModal();
  });
  
  // Insert video button
  const insertVideo = document.getElementById('insertVideo');
  if (insertVideo) {
    insertVideo.addEventListener('click', () => {
      saveSelection(); // Save cursor position before opening modal
      openModal('videoModal');
    });
  }
}

function convertToEmbed(url, width) {
  const height = Math.round(width * 9 / 16);
  
  // YouTube
  let match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
  if (match) {
    return `<iframe width="${width}" height="${height}" src="https://www.youtube.com/embed/${match[1]}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen style="max-width: 100%; border-radius: 8px;"></iframe>`;
  }
  
  // Vimeo
  match = url.match(/vimeo\.com\/(\d+)/);
  if (match) {
    return `<iframe width="${width}" height="${height}" src="https://player.vimeo.com/video/${match[1]}" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen style="max-width: 100%; border-radius: 8px;"></iframe>`;
  }
  
  return null;
}

function resetVideoModal() {
  // Reset inputs
  const videoUrl = document.getElementById('videoUrl');
  const videoEmbed = document.getElementById('videoEmbed');
  if (videoUrl) videoUrl.value = '';
  if (videoEmbed) videoEmbed.value = '';
  
  // Reset to embed tab (first tab)
  const modal = document.getElementById('videoModal');
  if (modal) {
    const tabs = modal.querySelectorAll('.modal-tab');
    tabs.forEach((t, i) => t.classList.toggle('active', i === 0));
    const embedSection = document.getElementById('videoEmbedSection');
    const urlSection = document.getElementById('videoUrlSection');
    if (embedSection) embedSection.classList.remove('hidden');
    if (urlSection) urlSection.classList.add('hidden');
  }
}

// File Modal Initialization - URL only
function initFileModal() {
  // Confirm file - URL only
  const confirmBtn = document.getElementById('confirmFile');
  if (confirmBtn) {
    confirmBtn.addEventListener('click', () => {
      const fileUrl = document.getElementById('fileUrl').value;
      const linkText = document.getElementById('fileLinkText').value || 'לחץ להורדה';
      
      if (!fileUrl) {
        showToast('יש להזין כתובת URL לקובץ', 'error');
        return;
      }
      
      // Restore selection and focus editor
      editor.focus();
      restoreSelection();
      
      // Create a link to the file
      const fileHtml = `<a href="${fileUrl}" target="_blank" style="display: inline-flex; align-items: center; gap: 8px; padding: 10px 16px; background: #f3f4f6; border-radius: 6px; color: #374151; text-decoration: none; border: 1px solid #e5e7eb;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z"/>
        </svg>
        ${linkText}
      </a>&nbsp;`;
      
      document.execCommand('insertHTML', false, fileHtml);
      showToast('הקישור לקובץ הוסף בהצלחה', 'success');
      closeModal('fileModal');
      resetFileModal();
    });
  }
  
  const cancelBtn = document.getElementById('cancelFile');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      closeModal('fileModal');
      resetFileModal();
    });
  }
  
  // Insert file button
  const insertFile = document.getElementById('insertFile');
  if (insertFile) {
    insertFile.addEventListener('click', () => {
      saveSelection(); // Save cursor position before opening modal
      openModal('fileModal');
    });
  }
}

function resetFileModal() {
  const fileUrl = document.getElementById('fileUrl');
  const linkText = document.getElementById('fileLinkText');
  
  if (fileUrl) fileUrl.value = '';
  if (linkText) linkText.value = '';
}

function openModal(modalId) {
  document.getElementById(modalId).classList.add('active');
}

function closeModal(modalId) {
  document.getElementById(modalId).classList.remove('active');
}

function clearModalInputs(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  
  modal.querySelectorAll('input').forEach(input => {
    try {
      // Skip color pickers - they should keep their default values
      if (input.type === 'color') {
        // Only reset if it doesn't have a valid value
        if (!input.value || input.value === '') {
          if (input.id === 'bgColor') {
            input.value = '#ffff00';
          } else if (input.id === 'buttonColor') {
            input.value = '#3b82f6';
          } else if (input.id === 'textColor') {
            input.value = '#000000';
          } else {
            input.value = '#000000';
          }
        }
      } else if (input.type !== 'number' && input.type !== 'color') {
        input.value = '';
      }
    } catch (e) {
      console.warn('Error clearing input:', e);
    }
  });
}

// Templates
function initTemplates() {
  // Built-in templates
  document.querySelectorAll('#builtinTemplates .template-card').forEach(card => {
    card.addEventListener('click', () => {
      const templateName = card.dataset.template;
      const template = getTemplate(templateName);
      if (template) {
        loadTemplateToEditor(template, templateName);
      }
    });
  });
  
  // Load personal templates
  loadPersonalTemplates();
  
  // Import template
  const importBtn = document.getElementById('importTemplate');
  const fileInput = document.getElementById('templateFileInput');
  
  if (importBtn && fileInput) {
    importBtn.addEventListener('click', () => {
      fileInput.click();
    });
    
    fileInput.addEventListener('change', (e) => {
      const files = e.target.files;
      if (files.length === 0) return;
      
      Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onload = (event) => {
          const html = event.target.result;
          const name = file.name.replace(/\.(html|htm)$/i, '');
          const templateId = `personal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          
          chrome.storage.local.get(['personalTemplates'], (result) => {
            const personalTemplates = result.personalTemplates || {};
            personalTemplates[templateId] = {
              name: name,
              html: html,
              created: Date.now()
            };
            chrome.storage.local.set({ personalTemplates: personalTemplates }, () => {
              loadPersonalTemplates();
            });
          });
        };
        reader.readAsText(file);
      });
      
      showToast('התבניות יובאו בהצלחה', 'success');
      // Don't reset color pickers
      if (e.target.type !== 'color') {
        e.target.value = ''; // Reset input
      }
    });
  }
  
  // Export all templates
  const exportAllBtn = document.getElementById('exportAllTemplates');
  if (exportAllBtn) {
    exportAllBtn.addEventListener('click', exportAllTemplates);
  }
  
  // Edit template modal handlers
  const confirmEditBtn = document.getElementById('confirmEditTemplate');
  const cancelEditBtn = document.getElementById('cancelEditTemplate');
  
  if (confirmEditBtn) {
    confirmEditBtn.addEventListener('click', () => {
      const id = document.getElementById('editTemplateId').value;
      const name = document.getElementById('editTemplateName').value.trim();
      
      if (!name) {
        showToast('יש להזין שם לתבנית', 'error');
        return;
      }
      
      chrome.storage.local.get(['personalTemplates'], (result) => {
        const personalTemplates = result.personalTemplates || {};
        if (personalTemplates[id]) {
          personalTemplates[id].name = name;
          chrome.storage.local.set({ personalTemplates: personalTemplates }, () => {
            showToast('התבנית עודכנה', 'success');
            closeModal('editTemplateModal');
            loadPersonalTemplates();
          });
        }
      });
    });
  }
  
  if (cancelEditBtn) {
    cancelEditBtn.addEventListener('click', () => {
      closeModal('editTemplateModal');
    });
  }
}

function loadTemplateToEditor(html, templateName = null) {
  editor.innerHTML = html;
  
  // Save the template name if provided
  if (templateName) {
    currentTemplateName = templateName;
  }
  
  // Switch to visual tab
  tabs.forEach(t => t.classList.remove('active'));
  document.querySelector('[data-tab="visual"]').classList.add('active');
  tabContents.forEach(c => c.classList.remove('active'));
  document.getElementById('visual-content').classList.add('active');
  toolbar.style.display = 'flex';
  document.getElementById('subjectWrapper').style.display = 'flex';
  
  // Save the loaded template so it persists
  saveContent();
  
  showToast(msg('templateLoaded') || 'התבנית נטענה בהצלחה', 'success');
}

function loadPersonalTemplates() {
  const container = document.getElementById('personalTemplates');
  const emptyMessage = document.getElementById('noPersonalTemplates');
  
  chrome.storage.local.get(['personalTemplates'], (result) => {
    const templates = result.personalTemplates || {};
    const templateIds = Object.keys(templates);
    
    // Clear existing personal templates (keep empty message)
    container.querySelectorAll('.template-card').forEach(card => card.remove());
    
    if (templateIds.length === 0) {
      emptyMessage.style.display = 'block';
      return;
    }
    
    emptyMessage.style.display = 'none';
    
    // Sort by creation date (newest first)
    templateIds.sort((a, b) => templates[b].created - templates[a].created);
    
    templateIds.forEach(id => {
      const template = templates[id];
      const card = createPersonalTemplateCard(id, template);
      container.appendChild(card);
    });
  });
}

function createPersonalTemplateCard(id, template) {
  const card = document.createElement('div');
  card.className = 'template-card personal';
  card.innerHTML = `
    <div class="template-preview personal-preview"></div>
    <span title="${template.name}">${template.name}</span>
    <div class="template-card-actions">
      <button class="template-action-btn edit" title="ערוך שם">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
      </button>
      <button class="template-action-btn export" title="ייצא HTML">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
      </button>
      <button class="template-action-btn delete" title="מחק">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
        </svg>
      </button>
    </div>
  `;
  
  // Click to load
  card.addEventListener('click', (e) => {
    if (e.target.closest('.template-card-actions')) return;
    loadTemplateToEditor(template.html, null); // Personal templates don't have template names
  });
  
  // Edit button
  card.querySelector('.edit').addEventListener('click', () => {
    document.getElementById('editTemplateId').value = id;
    document.getElementById('editTemplateName').value = template.name;
    openModal('editTemplateModal');
  });
  
  // Export button
  card.querySelector('.export').addEventListener('click', () => {
    exportTemplate(template.name, template.html);
  });
  
  // Delete button
  card.querySelector('.delete').addEventListener('click', () => {
    if (confirm(`למחוק את התבנית "${template.name}"?`)) {
      deleteTemplate(id);
    }
  });
  
  return card;
}

function deleteTemplate(id) {
  chrome.storage.local.get(['personalTemplates'], (result) => {
    const templates = result.personalTemplates || {};
    delete templates[id];
    chrome.storage.local.set({ personalTemplates: templates }, () => {
      showToast('התבנית נמחקה', 'success');
      loadPersonalTemplates();
    });
  });
}

function exportTemplate(name, html) {
  const fullHtml = `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${name}</title>
</head>
<body style="margin: 0; padding: 20px; font-family: 'Heebo', Arial, sans-serif;">
${html}
</body>
</html>`;
  
  const blob = new Blob([fullHtml], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name}.html`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('התבנית יוצאה', 'success');
}

function exportAllTemplates() {
  chrome.storage.local.get(['personalTemplates'], (result) => {
    const templates = result.personalTemplates || {};
    const templateIds = Object.keys(templates);
    
    if (templateIds.length === 0) {
      showToast('אין תבניות לייצוא', 'error');
      return;
    }
    
    // Create a simple export - download each file
    // For proper ZIP, we'd need a library, so we'll do individual downloads
    templateIds.forEach((id, index) => {
      const template = templates[id];
      setTimeout(() => {
        exportTemplate(template.name, template.html);
      }, index * 200); // Stagger downloads
    });
    
    showToast(`מייצא ${templateIds.length} תבניות...`, 'success');
  });
}

// Footer Actions
function initFooterActions() {
  // Add Unsubscribe Link
  const addUnsubscribeBtn = document.getElementById('addUnsubscribeLink');
  if (addUnsubscribeBtn) {
    addUnsubscribeBtn.addEventListener('click', () => {
      // Save current selection
      saveSelection();
      
      // Focus editor
      editor.focus();
      restoreSelection();
      
      // Create unsubscribe link HTML with proper styling
      const unsubscribeHtml = '<p style="text-align: center; margin-top: 20px; margin-bottom: 10px; font-size: 12px; color: #666;"><a href="mailto:?subject=הסר" style="color: #666; text-decoration: underline;">הסר</a></p>';
      
      // Insert at cursor position
      try {
        document.execCommand('insertHTML', false, unsubscribeHtml);
      } catch (e) {
        // Fallback: append to end if insert fails
        editor.innerHTML += unsubscribeHtml;
      }
      
      showToast('שורת הסר נוספה', 'success');
      updatePreview();
    });
  }
  
  // Copy HTML dropdown
  const copyHtmlBtn = document.getElementById('copyHtml');
  const copyHtmlDropdownBtn = document.getElementById('copyHtmlDropdown');
  const copyHtmlDropdownMenu = document.getElementById('copyHtmlDropdownMenu');
  const copyHtmlBodyBtn = document.getElementById('copyHtmlBody');
  const copyHtmlFullBtn = document.getElementById('copyHtmlFull');
  
  // Toggle dropdown on arrow click
  if (copyHtmlDropdownBtn && copyHtmlDropdownMenu) {
    copyHtmlDropdownBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      copyHtmlDropdownMenu.classList.toggle('show');
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!copyHtmlBtn.contains(e.target) && !copyHtmlDropdownMenu.contains(e.target)) {
        copyHtmlDropdownMenu.classList.remove('show');
      }
    });
  }
  
  // Copy body content (default action - when clicking main button, not arrow)
  if (copyHtmlBtn) {
    copyHtmlBtn.addEventListener('click', async (e) => {
      // Don't trigger if clicking the arrow
      if (e.target.closest('.copy-html-arrow')) {
        return;
      }
      
      // Copy only the visible body content, not the full HTML structure
      const html = editor ? editor.innerHTML : '';
      await copyToClipboard(html);
      copyHtmlDropdownMenu?.classList.remove('show');
    });
  }
  
  // Copy body content option
  if (copyHtmlBodyBtn) {
    copyHtmlBodyBtn.addEventListener('click', async () => {
      const html = editor ? editor.innerHTML : '';
      await copyToClipboard(html);
      copyHtmlDropdownMenu?.classList.remove('show');
    });
  }
  
  // Copy full HTML option
  if (copyHtmlFullBtn) {
    copyHtmlFullBtn.addEventListener('click', async () => {
      const html = getFullHtml();
      await copyToClipboard(html);
      copyHtmlDropdownMenu?.classList.remove('show');
    });
  }
  
  // Helper function to copy to clipboard
  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      showToast('הקוד הועתק ללוח!', 'success');
    } catch (err) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      showToast('הקוד הועתק ללוח!', 'success');
    }
  }
  
  // Save Template - Open modal
  const saveTemplateBtn = document.getElementById('saveTemplate');
  if (saveTemplateBtn) {
    saveTemplateBtn.addEventListener('click', () => {
      openModal('saveTemplateModal');
      const templateNameInput = document.getElementById('templateName');
      if (templateNameInput) {
        templateNameInput.value = '';
        templateNameInput.focus();
      }
    });
  }
  
  // Confirm save template
  const confirmSaveBtn = document.getElementById('confirmSaveTemplate');
  if (confirmSaveBtn) {
    confirmSaveBtn.addEventListener('click', () => {
      const templateNameInput = document.getElementById('templateName');
      const name = templateNameInput ? templateNameInput.value.trim() : '';
      if (!name) {
        showToast('יש להזין שם לתבנית', 'error');
        return;
      }
      
      const html = editor.innerHTML;
      const templateId = `personal_${Date.now()}`;
      
      chrome.storage.local.get(['personalTemplates'], (result) => {
        const personalTemplates = result.personalTemplates || {};
        personalTemplates[templateId] = {
          name: name,
          html: html,
          created: Date.now()
        };
        chrome.storage.local.set({ personalTemplates: personalTemplates }, () => {
          showToast('התבנית נשמרה!', 'success');
          closeModal('saveTemplateModal');
          loadPersonalTemplates();
        });
      });
    });
  }
  
  const cancelSaveBtn = document.getElementById('cancelSaveTemplate');
  if (cancelSaveBtn) {
    cancelSaveBtn.addEventListener('click', () => {
      closeModal('saveTemplateModal');
    });
  }
  
  // Insert to Email (Gmail, Outlook, Yahoo, ProtonMail)
  const insertToGmailBtn = document.getElementById('insertToGmail');
  if (insertToGmailBtn) {
    insertToGmailBtn.addEventListener('click', async () => {
      const html = getFullHtml();
      const subject = emailSubject ? emailSubject.value : '';
    
    try {
      // Get the active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      // Check if it's a supported email service
      const supportedServices = {
        'mail.google.com': 'Gmail',
        'outlook.live.com': 'Outlook',
        'outlook.office.com': 'Outlook',
        'outlook.office365.com': 'Outlook',
        'mail.yahoo.com': 'Yahoo Mail',
        'mail.proton.me': 'ProtonMail',
        'mail.protonmail.com': 'ProtonMail'
      };
      
      let detectedService = null;
      for (const [domain, serviceName] of Object.entries(supportedServices)) {
        if (tab.url && tab.url.includes(domain)) {
          detectedService = serviceName;
          break;
        }
      }
      
      if (!detectedService) {
        showToast('יש לפתוח Gmail, Outlook, Yahoo או ProtonMail', 'error');
        return;
      }
      
      // First, try to inject the content script if not already loaded
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js']
        });
      } catch (e) {
        // Script might already be injected, continue
      }
      
      // Small delay to ensure script is ready
      setTimeout(() => {
        chrome.tabs.sendMessage(tab.id, {
          action: 'insertHtml',
          html: html,
          subject: subject
        }, (response) => {
          // Check for runtime errors
          if (chrome.runtime.lastError) {
            showToast(`רענן את ${detectedService} ונסה שוב`, 'error');
            return;
          }
          
          if (response && response.success) {
            showToast(`התוכן הוכנס ל-${detectedService}!`, 'success');
          } else {
            showToast(`פתח חלון הודעה חדשה ב-${detectedService} תחילה`, 'error');
          }
        });
      }, 100);
      
    } catch (err) {
      console.error(err);
      showToast('שגיאה בהכנסת התוכן', 'error');
    }
    });
  }
}

// Editor Sync
function initEditorSync() {
  // Sync HTML editor changes to visual editor on tab switch
  htmlEditor.addEventListener('input', () => {
    // Will be synced when switching to visual tab
  });
  
  // Handle paste in visual editor
  editor.addEventListener('paste', (e) => {
    // Allow rich text paste by default
    // Can add text-only paste option if needed
  });
  
  // Clear placeholder on focus
  editor.addEventListener('focus', () => {
    if (editor.innerText === 'התחל לכתוב את ההודעה שלך כאן...') {
      editor.innerHTML = '<p></p>';
    }
  });
}

// Get clean HTML from editor
function getCleanHtml() {
  return editor.innerHTML;
}

// Extract body content from full HTML document (for HTML editor sync)
function extractBodyContentFromHtml(html) {
  // Check if it's a full HTML document
  if (html.includes('<body') && html.includes('</body>')) {
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    if (bodyMatch) {
      return bodyMatch[1].trim();
    }
  }
  // If not a full document, return as is
  return html;
}

// Get full HTML - always returns complete HTML document
function getFullHtml(withVariableReplacement = true) {
  let content = editor.innerHTML;
  
  // If content is empty or only contains empty paragraph, use empty string
  // This ensures we always have a proper body structure
  if (!content || content.trim() === '' || content.trim() === '<p></p>' || content.trim() === '<br>') {
    content = '';
  }
  
  // Replace variables if requested
  if (withVariableReplacement && typeof replaceVariables === 'function') {
    content = replaceVariables(content);
  }
  
  // Build body style - includes background and base styles
  let bodyStyle = "margin: 0; padding: 20px; font-family: 'Heebo', Arial, sans-serif; min-height: 100%;";
  
  // Add background color
  if (emailBgColor) {
    bodyStyle += ` background-color: ${emailBgColor};`;
  }
  
  // Add background image (if both exist, image will overlay color)
  if (emailBgImage) {
    bodyStyle += ` background-image: url('${emailBgImage}');`;
    bodyStyle += ` background-repeat: ${emailBgImageRepeat};`;
    bodyStyle += ` background-size: ${emailBgImageSize};`;
    bodyStyle += ` background-position: center;`;
    bodyStyle += ` background-attachment: scroll;`;
  }
  
  // Always return complete HTML document structure
  return `<!DOCTYPE html>
<html dir="${emailDirection}" lang="${emailLanguage}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="${bodyStyle}">
${content}
</body>
</html>`;
}

// Update preview
function updatePreview() {
  const html = getFullHtml();
  const doc = previewFrame.contentDocument || previewFrame.contentWindow.document;
  doc.open();
  doc.write(html);
  doc.close();
}

// Toast notification
function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast ${type} show`;
  
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  // Only apply shortcuts when editor is focused or in popup
  const isEditorFocused = document.activeElement === editor || editor?.contains(document.activeElement);
  
  if (e.ctrlKey || e.metaKey) {
    switch(e.key.toLowerCase()) {
      case 's':
        e.preventDefault();
        document.getElementById('saveTemplate').click();
        break;
      case 'b':
        if (isEditorFocused) {
          e.preventDefault();
          document.execCommand('bold', false, null);
        }
        break;
      case 'i':
        if (isEditorFocused) {
          e.preventDefault();
          document.execCommand('italic', false, null);
        }
        break;
      case 'u':
        if (isEditorFocused) {
          e.preventDefault();
          document.execCommand('underline', false, null);
        }
        break;
      case 'k':
        if (isEditorFocused) {
          e.preventDefault();
          openModal('linkModal');
        }
        break;
      case 'l':
        if (isEditorFocused && e.shiftKey) {
          e.preventDefault();
          document.execCommand('insertUnorderedList', false, null);
        } else if (isEditorFocused) {
          e.preventDefault();
          document.execCommand('justifyLeft', false, null);
        }
        break;
      case 'e':
        if (isEditorFocused) {
          e.preventDefault();
          document.execCommand('justifyCenter', false, null);
        }
        break;
      case 'r':
        if (isEditorFocused) {
          e.preventDefault();
          document.execCommand('justifyRight', false, null);
        }
        break;
      case 'j':
        if (isEditorFocused) {
          e.preventDefault();
          document.execCommand('justifyFull', false, null);
        }
        break;
      case 'o':
        if (isEditorFocused && e.shiftKey) {
          e.preventDefault();
          document.execCommand('insertOrderedList', false, null);
        }
        break;
      case 'z':
        if (isEditorFocused) {
          e.preventDefault();
          document.execCommand('undo', false, null);
        }
        break;
      case 'y':
        if (isEditorFocused) {
          e.preventDefault();
          document.execCommand('redo', false, null);
        }
        break;
    }
    // Strikethrough: Ctrl+Shift+X
    if (e.shiftKey && e.key.toLowerCase() === 'x' && isEditorFocused) {
      e.preventDefault();
      document.execCommand('strikeThrough', false, null);
    }
  }
  
  // Escape to close modals
  if (e.key === 'Escape') {
    const openModal = document.querySelector('.modal.show');
    if (openModal) {
      openModal.classList.remove('show');
    }
  }
});

// Color Dropdowns
let savedSelection = null;

function saveSelection() {
  const sel = window.getSelection();
  if (sel.rangeCount > 0) {
    savedSelection = sel.getRangeAt(0).cloneRange();
  }
}

function restoreSelection() {
  if (savedSelection) {
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(savedSelection);
  }
}

// Apply text color to selected text or set for next input
function applyTextColor(color) {
  editor.focus();
  restoreSelection();
  
  const selection = window.getSelection();
  if (!selection.rangeCount) return;
  
  const range = selection.getRangeAt(0);
  
  // If no text is selected, insert a colored span for next typing
  if (range.collapsed) {
    const colorSpan = document.createElement('span');
    colorSpan.setAttribute('style', `color: ${color} !important;`);
    colorSpan.innerHTML = '&#8203;'; // Zero-width space
    range.insertNode(colorSpan);
    
    // Move cursor inside the span
    range.setStart(colorSpan, 1);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
    updatePreview();
    return;
  }
  
  // Get the selected content
  const fragment = range.extractContents();
  
  // Create a span with the color - use !important to override CSS
  const colorSpan = document.createElement('span');
  colorSpan.setAttribute('style', `color: ${color} !important;`);
  colorSpan.appendChild(fragment);
  
  // Insert the colored span
  range.insertNode(colorSpan);
  
  // Select the new span
  range.selectNodeContents(colorSpan);
  selection.removeAllRanges();
  selection.addRange(range);
  
  // Save for next operation
  saveSelection();
  updatePreview();
}

function initColorSwatches() {
  const colorPaletteBtn = document.getElementById('colorPaletteBtn');
  const colorDropdownMenu = document.getElementById('colorDropdownMenu');
  const emailBgColorBtn = document.getElementById('emailBgColorBtn');
  const emailBgColorDropdownMenu = document.getElementById('emailBgColorDropdownMenu');
  const currentColorIcon = document.getElementById('currentColorIcon');
  
  // Exit if elements don't exist
  if (!colorPaletteBtn || !colorDropdownMenu || !currentColorIcon) {
    return;
  }
  
  // Toggle text color dropdown
  colorPaletteBtn.addEventListener('mousedown', (e) => {
    e.preventDefault(); // Prevent focus loss
    saveSelection();
  });
  colorPaletteBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (emailBgColorDropdownMenu) emailBgColorDropdownMenu.classList.remove('show');
    colorDropdownMenu.classList.toggle('show');
  });
  
  // Toggle email background color dropdown
  if (emailBgColorBtn && emailBgColorDropdownMenu) {
    emailBgColorBtn.addEventListener('mousedown', (e) => {
      e.preventDefault();
    });
    emailBgColorBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      colorDropdownMenu.classList.remove('show');
      emailBgColorDropdownMenu.classList.toggle('show');
    });
  }
  
  // Close dropdowns when clicking outside
  document.addEventListener('click', () => {
    colorDropdownMenu.classList.remove('show');
    if (emailBgColorDropdownMenu) emailBgColorDropdownMenu.classList.remove('show');
  });
  
  // Prevent closing when clicking inside dropdown
  colorDropdownMenu.addEventListener('mousedown', (e) => e.preventDefault());
  colorDropdownMenu.addEventListener('click', (e) => e.stopPropagation());
  if (emailBgColorDropdownMenu) {
    emailBgColorDropdownMenu.addEventListener('mousedown', (e) => e.preventDefault());
    emailBgColorDropdownMenu.addEventListener('click', (e) => e.stopPropagation());
  }
  
  // Text color swatches
  document.querySelectorAll('.color-swatch').forEach(swatch => {
    swatch.addEventListener('click', () => {
      const color = swatch.dataset.color;
      colorDropdownMenu.classList.remove('show');
      
      applyTextColor(color);
      
      // Update icon color
      if (currentColorIcon) {
        currentColorIcon.style.color = color;
      }
    });
  });
  
  // Custom color pickers
  const textColor = document.getElementById('textColor');
  const emailBgColorInput = document.getElementById('emailBgColor');
  
  if (textColor) {
    textColor.addEventListener('focus', () => saveSelection());
    textColor.addEventListener('input', (e) => {
      const color = e.target.value;
      applyTextColor(color);
      // Update icon color
      if (currentColorIcon) {
        currentColorIcon.style.color = color;
      }
    });
  }
  
  if (emailBgColorInput) {
    emailBgColorInput.addEventListener('input', (e) => {
      emailBgColor = e.target.value;
      updatePreview();
      saveContent(); // Save background color change
      showToast('צבע רקע עודכן', 'success');
    });
  }
}

// Toggle text direction (RTL/LTR)
function initDirectionToggle() {
  const toggleDirectionBtn = document.getElementById('toggleDirection');
  const directionIcon = document.getElementById('directionIcon');
  
  if (!toggleDirectionBtn || !directionIcon) return;
  
  // Update icon based on current direction
  function updateDirectionIcon() {
    if (emailDirection === 'rtl') {
      // RTL icon - arrows pointing right
      directionIcon.innerHTML = '<path d="M9 10v5h2v-2h2v-2h-2V9H9v1zm6-1v2h-2v2h2v2h2V9h-2zm-4 8H3v-2h8v2zm0-4H3v-2h8v2zm0-4H3V7h8v2zm10-4v2h-4V6h4zm0 4v2h-4v-2h4zm0 4v2h-4v-2h4z"/>';
    } else {
      // LTR icon - arrows pointing left
      directionIcon.innerHTML = '<path d="M15 10v5h-2v-2h-2v-2h2V9h2v1zm-6-1v2h2v2h-2v2H7V9h2zm4 8h8v-2h-8v2zm0-4h8v-2h-8v2zm0-4h8V7h-8v2zm-10-4v2h4V6H3zm0 4v2h4v-2H3zm0 4v2h4v-2H3z"/>';
    }
  }
  
  // Initialize icon
  updateDirectionIcon();
  
  // Toggle direction on click
  toggleDirectionBtn.addEventListener('click', () => {
    emailDirection = emailDirection === 'rtl' ? 'ltr' : 'rtl';
    
    // Update editor direction
    if (editor) {
      editor.setAttribute('dir', emailDirection);
    }
    
    // Update preview
    updatePreview();
    
    // Save changes
    saveContent();
    
    // Update icon
    updateDirectionIcon();
    
    // Show toast
    const directionText = emailDirection === 'rtl' ? 'ימין לשמאל' : 'שמאל לימין';
    showToast(`כיוון קריאה: ${directionText}`, 'success');
  });
}

// Language Selection
function initLanguageSelector() {
  const languageBtn = document.getElementById('languageBtn');
  const languageDropdownMenu = document.getElementById('languageDropdownMenu');
  const currentLanguageCode = document.getElementById('currentLanguageCode');
  
  if (!languageBtn || !languageDropdownMenu || !currentLanguageCode) return;
  
  // Language names mapping
  const languageNames = {
    'he': 'עברית',
    'en': 'English',
    'ar': 'العربية',
    'es': 'Español',
    'fr': 'Français',
    'de': 'Deutsch',
    'ru': 'Русский',
    'zh': '中文',
    'ja': '日本語',
    'pt': 'Português'
  };
  
  // Update current language display
  function updateLanguageDisplay() {
    currentLanguageCode.textContent = emailLanguage;
  }
  
  // Initialize display
  updateLanguageDisplay();
  
  // Toggle dropdown
  languageBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    languageDropdownMenu.classList.toggle('show');
  });
  
  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (!languageBtn.contains(e.target) && !languageDropdownMenu.contains(e.target)) {
      languageDropdownMenu.classList.remove('show');
    }
  });
  
  // Handle language selection
  const languageOptions = languageDropdownMenu.querySelectorAll('.language-option');
  languageOptions.forEach(option => {
    option.addEventListener('click', () => {
      const lang = option.dataset.lang;
      emailLanguage = lang;
      
      // Update display
      updateLanguageDisplay();
      
      // Update preview
      updatePreview();
      
      // Save changes
      saveContent();
      
      // Close dropdown
      languageDropdownMenu.classList.remove('show');
      
      // Show toast
      const langName = languageNames[lang] || lang;
      showToast(`שפת ההודעה: ${langName}`, 'success');
    });
  });
}

// New Tools - Quote, Code, Button, Heading, Clear
function initNewTools() {
  // Insert Quote
  const insertQuote = document.getElementById('insertQuote');
  if (insertQuote) {
    insertQuote.addEventListener('click', () => {
      const quoteHtml = `<blockquote style="border-right: 4px solid #6366f1; padding: 12px 20px; margin: 15px 0; background: #f3f4f6; color: #4b5563; font-style: italic;">ציטוט כאן...</blockquote>`;
      document.execCommand('insertHTML', false, quoteHtml);
      editor.focus();
    });
  }
  
  // Insert Code
  const insertCode = document.getElementById('insertCode');
  if (insertCode) {
    insertCode.addEventListener('click', () => {
      const codeHtml = `<code style="background: #1f2937; color: #10b981; padding: 2px 6px; border-radius: 4px; font-family: 'Courier New', monospace;">קוד כאן</code>`;
      document.execCommand('insertHTML', false, codeHtml);
      editor.focus();
    });
  }
  
  // Insert Text Box (Word-style - draggable and resizable)
  const insertTextBox = document.getElementById('insertTextBox');
  if (insertTextBox) {
    insertTextBox.addEventListener('click', () => {
      saveSelection();
      editor.focus();
      restoreSelection();
      
      // Word-style text box: draggable and resizable (very small initial size)
      const textBoxId = 'textbox-' + Date.now();
      const placeholderText = msg('textBoxPlaceholder') || 'הזן טקסט כאן';
      const textBoxHtml = `<div class="word-textbox" data-textbox-id="${textBoxId}" style="position: relative; display: inline-block; width: 60px; height: 30px; padding: 4px; margin: 10px 0; cursor: move;">
  <div class="textbox-content" contenteditable="true" style="min-height: 22px; outline: none;">
    <p style="margin: 0; font-size: 11px;">${placeholderText}</p>
  </div>
  <div class="textbox-handles">
    <div class="textbox-handle textbox-handle-nw" data-handle="nw"></div>
    <div class="textbox-handle textbox-handle-n" data-handle="n"></div>
    <div class="textbox-handle textbox-handle-ne" data-handle="ne"></div>
    <div class="textbox-handle textbox-handle-e" data-handle="e"></div>
    <div class="textbox-handle textbox-handle-se" data-handle="se"></div>
    <div class="textbox-handle textbox-handle-s" data-handle="s"></div>
    <div class="textbox-handle textbox-handle-sw" data-handle="sw"></div>
    <div class="textbox-handle textbox-handle-w" data-handle="w"></div>
  </div>
</div>`;
      document.execCommand('insertHTML', false, textBoxHtml);
      
      // Initialize text box after insertion
      setTimeout(() => {
        initAllWordTextBoxes();
      }, 100);
      
      editor.focus();
      updatePreview();
    });
  }
  
  // Initialize all text boxes when editor content changes
  editor.addEventListener('input', () => {
    setTimeout(() => {
      initAllWordTextBoxes();
    }, 100);
  });
  
  // Insert Button
  const insertButton = document.getElementById('insertButton');
  if (insertButton) {
    insertButton.addEventListener('click', () => {
      openModal('buttonModal');
    });
  }
  
  // Button Modal handlers
  const confirmButton = document.getElementById('confirmButton');
  if (confirmButton) {
    confirmButton.addEventListener('click', () => {
      const text = document.getElementById('buttonText').value || 'לחץ כאן';
      const url = document.getElementById('buttonUrl').value || '#';
      const color = document.getElementById('buttonColor').value || '#3b82f6';
      
      const buttonHtml = `<a href="${url}" style="display: inline-block; background: ${color}; color: white; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-weight: 500; margin: 10px 0;">${text}</a>`;
      document.execCommand('insertHTML', false, buttonHtml);
      closeModal('buttonModal');
      clearModalInputs('buttonModal');
      editor.focus();
    });
  }
  
  const cancelButton = document.getElementById('cancelButton');
  if (cancelButton) {
    cancelButton.addEventListener('click', () => {
      closeModal('buttonModal');
      clearModalInputs('buttonModal');
    });
  }
  
  // Clear All
  const clearAll = document.getElementById('clearAll');
  if (clearAll) {
    clearAll.addEventListener('click', () => {
      if (confirm('האם אתה בטוח שברצונך למחוק את כל התוכן?')) {
        currentTemplateName = null; // Reset template tracking when clearing
        editor.innerHTML = '<p></p>';
        emailSubject.value = '';
        saveContent();
        editor.focus();
        showToast('התוכן נמחק', 'success');
      }
    });
  }
}

// Initialize Word-style text box (draggable and resizable)
function initWordTextBox(textBox) {
  if (!textBox || textBox.dataset.initialized === 'true') return;
  textBox.dataset.initialized = 'true';
  
  const content = textBox.querySelector('.textbox-content');
  const handles = textBox.querySelectorAll('.textbox-handle');
  
  // Make handles non-editable and non-selectable
  handles.forEach(handle => {
    handle.setAttribute('contenteditable', 'false');
    handle.setAttribute('draggable', 'false');
  });
  
  // Make text box container non-editable (only content is editable)
  textBox.setAttribute('contenteditable', 'false');
  
  let isDragging = false;
  let isResizing = false;
  let resizeHandle = null;
  let startX, startY, startWidth, startHeight, startLeft, startTop;
  
  // Prevent deletion of handles - make them non-editable
  handles.forEach(handle => {
    handle.setAttribute('contenteditable', 'false');
    handle.setAttribute('draggable', 'false');
  });
  
  // Make text box container and handles container non-editable
  textBox.setAttribute('contenteditable', 'false');
  const handlesContainer = textBox.querySelector('.textbox-handles');
  if (handlesContainer) {
    handlesContainer.setAttribute('contenteditable', 'false');
  }
  
  // Ensure content is editable and separate from text box deletion
  if (content) {
    content.setAttribute('contenteditable', 'true');
    // Prevent content clicks from selecting text box
    content.addEventListener('click', (e) => {
      e.stopPropagation(); // Don't trigger text box selection when clicking content
    });
    // Prevent content mousedown from triggering drag
    content.addEventListener('mousedown', (e) => {
      e.stopPropagation(); // Don't trigger text box drag when clicking content
    });
  }
  
  // Handle deletion of entire text box when selected (but not when editing content)
  const handleKeyDown = (e) => {
    // Only handle if text box is selected
    if (!textBox.classList.contains('selected')) return;
    
    if (e.key === 'Backspace' || e.key === 'Delete') {
      const selection = window.getSelection();
      
      // Check if user is editing content (selection is inside content)
      if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const commonAncestor = range.commonAncestorContainer;
        
        // If selection is inside content, allow normal text editing
        if (content && (content.contains(commonAncestor) || commonAncestor === content)) {
          // Check if trying to delete a handle (prevent)
          const isHandle = (commonAncestor.nodeType === Node.ELEMENT_NODE && 
                           (commonAncestor.classList?.contains('textbox-handle') ||
                            commonAncestor.closest('.textbox-handle'))) ||
                          (range.startContainer.nodeType === Node.ELEMENT_NODE && 
                           range.startContainer.classList?.contains('textbox-handle')) ||
                          (range.endContainer.nodeType === Node.ELEMENT_NODE && 
                           range.endContainer.classList?.contains('textbox-handle'));
          
          if (isHandle) {
            // Prevent deletion of handles
            e.preventDefault();
            e.stopPropagation();
          }
          // Otherwise, allow normal text editing
          return;
        }
        
        // Check if trying to delete a handle (prevent)
        const isHandle = (commonAncestor.nodeType === Node.ELEMENT_NODE && 
                         (commonAncestor.classList?.contains('textbox-handle') ||
                          commonAncestor.closest('.textbox-handle'))) ||
                        (range.startContainer.nodeType === Node.ELEMENT_NODE && 
                         range.startContainer.classList?.contains('textbox-handle')) ||
                        (range.endContainer.nodeType === Node.ELEMENT_NODE && 
                         range.endContainer.classList?.contains('textbox-handle'));
        
        if (isHandle) {
          // Prevent deletion of handles
          e.preventDefault();
          e.stopPropagation();
          return;
        }
      }
      
      // If not editing content and text box is selected, delete entire text box
      // But only if selection is not inside content
      if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const commonAncestor = range.commonAncestorContainer;
        if (content && !content.contains(commonAncestor) && commonAncestor !== content) {
          e.preventDefault();
          e.stopPropagation();
          textBox.remove();
          updatePreview();
          saveContent();
        }
      } else {
        // No selection, but text box is selected - delete it
        e.preventDefault();
        e.stopPropagation();
        textBox.remove();
        updatePreview();
        saveContent();
      }
    }
  };
  
  // Add event listener to editor (capture phase to catch before contenteditable handles it)
  editor.addEventListener('keydown', handleKeyDown, true);
  
  // Click to select text box
  textBox.addEventListener('click', (e) => {
    if (e.target.classList.contains('textbox-handle')) return;
    
    // Deselect all other text boxes
    editor.querySelectorAll('.word-textbox').forEach(tb => {
      tb.classList.remove('selected');
    });
    
    // Select this text box
    textBox.classList.add('selected');
    e.stopPropagation();
  });
  
  // Deselect when clicking outside
  editor.addEventListener('click', (e) => {
    if (!e.target.closest('.word-textbox')) {
      editor.querySelectorAll('.word-textbox').forEach(tb => {
        tb.classList.remove('selected');
      });
    }
  });
  
  // Drag functionality
  textBox.addEventListener('mousedown', (e) => {
    if (e.target.classList.contains('textbox-handle')) return;
    
    isDragging = true;
    const rect = textBox.getBoundingClientRect();
    const editorRect = editor.getBoundingClientRect();
    
    startX = e.clientX;
    startY = e.clientY;
    startLeft = rect.left - editorRect.left + editor.scrollLeft;
    startTop = rect.top - editorRect.top + editor.scrollTop;
    
    textBox.style.position = 'absolute';
    textBox.style.left = startLeft + 'px';
    textBox.style.top = startTop + 'px';
    textBox.style.margin = '0';
    
    e.preventDefault();
  });
  
  // Resize functionality
  handles.forEach(handle => {
    handle.addEventListener('mousedown', (e) => {
      isResizing = true;
      resizeHandle = handle.dataset.handle;
      
      const rect = textBox.getBoundingClientRect();
      const editorRect = editor.getBoundingClientRect();
      
      startX = e.clientX;
      startY = e.clientY;
      startWidth = rect.width;
      startHeight = rect.height;
      // Calculate position relative to editor
      startLeft = rect.left - editorRect.left + editor.scrollLeft;
      startTop = rect.top - editorRect.top + editor.scrollTop;
      
      // Ensure text box is positioned absolutely
      if (textBox.style.position !== 'absolute') {
        textBox.style.position = 'absolute';
        textBox.style.left = startLeft + 'px';
        textBox.style.top = startTop + 'px';
        textBox.style.margin = '0';
      }
      
      e.preventDefault();
      e.stopPropagation();
    });
  });
  
  // Mouse move handler
  const handleMouseMove = (e) => {
    if (isResizing && resizeHandle) {
      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;
      
      let newWidth = startWidth;
      let newHeight = startHeight;
      let newLeft = startLeft;
      let newTop = startTop;
      
      // Get editor bounds
      const editorRect = editor.getBoundingClientRect();
      const editorWidth = editor.scrollWidth;
      const editorHeight = editor.scrollHeight;
      
      // Handle resize based on handle position
      if (resizeHandle.includes('e')) {
        // Resize from east (right)
        const maxWidth = editorWidth - startLeft;
        newWidth = Math.max(60, Math.min(startWidth + deltaX, maxWidth));
      }
      if (resizeHandle.includes('w')) {
        // Resize from west (left)
        const maxWidth = startLeft + startWidth;
        newWidth = Math.max(60, Math.min(startWidth - deltaX, maxWidth));
        newLeft = startLeft + (startWidth - newWidth);
        // Ensure left doesn't go below 0
        if (newLeft < 0) {
          newWidth = startLeft + startWidth;
          newLeft = 0;
        }
      }
      if (resizeHandle.includes('s')) {
        // Resize from south (bottom)
        const maxHeight = editorHeight - startTop;
        newHeight = Math.max(30, Math.min(startHeight + deltaY, maxHeight));
      }
      if (resizeHandle.includes('n')) {
        // Resize from north (top)
        const maxHeight = startTop + startHeight;
        newHeight = Math.max(30, Math.min(startHeight - deltaY, maxHeight));
        newTop = startTop + (startHeight - newHeight);
        // Ensure top doesn't go below 0
        if (newTop < 0) {
          newHeight = startTop + startHeight;
          newTop = 0;
        }
      }
      
      // Final bounds check - ensure text box stays within editor
      const finalMaxLeft = editorWidth - newWidth;
      const finalMaxTop = editorHeight - newHeight;
      newLeft = Math.max(0, Math.min(newLeft, finalMaxLeft));
      newTop = Math.max(0, Math.min(newTop, finalMaxTop));
      
      // Adjust width/height if position was constrained
      if (newLeft === 0 && resizeHandle.includes('w')) {
        newWidth = Math.min(newWidth, startLeft + startWidth);
      }
      if (newTop === 0 && resizeHandle.includes('n')) {
        newHeight = Math.min(newHeight, startTop + startHeight);
      }
      if (newLeft + newWidth > editorWidth) {
        newWidth = editorWidth - newLeft;
      }
      if (newTop + newHeight > editorHeight) {
        newHeight = editorHeight - newTop;
      }
      
      // Ensure minimum size
      newWidth = Math.max(60, newWidth);
      newHeight = Math.max(30, newHeight);
      
      textBox.style.width = newWidth + 'px';
      textBox.style.height = newHeight + 'px';
      textBox.style.left = newLeft + 'px';
      textBox.style.top = newTop + 'px';
      
      updatePreview();
    } else if (isDragging) {
      const editorRect = editor.getBoundingClientRect();
      const newLeft = startLeft + (e.clientX - startX);
      const newTop = startTop + (e.clientY - startY);
      
      // Keep text box within editor bounds (optional - can be removed if not needed)
      const maxLeft = editor.scrollWidth - parseFloat(textBox.style.width || textBox.offsetWidth);
      const maxTop = editor.scrollHeight - parseFloat(textBox.style.height || textBox.offsetHeight);
      
      textBox.style.left = Math.max(0, Math.min(newLeft, maxLeft)) + 'px';
      textBox.style.top = Math.max(0, Math.min(newTop, maxTop)) + 'px';
      
      updatePreview();
    }
  };
  
  // Mouse up handler
  const handleMouseUp = (e) => {
    if (isDragging || isResizing) {
      isDragging = false;
      isResizing = false;
      resizeHandle = null;
      saveContent(); // Save position and size
    }
  };
  
  // Add event listeners to document (will be cleaned up when text box is removed)
  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);
}

// Initialize all text boxes in editor
function initAllWordTextBoxes() {
  editor.querySelectorAll('.word-textbox:not([data-initialized="true"])').forEach(textBox => {
    initWordTextBox(textBox);
  });
}

// Advanced Toolbar Toggle
function initAdvancedToggle() {
  const toggleBtn = document.getElementById('toggleAdvanced');
  const advancedToolbar = document.getElementById('advancedToolbar');
  
  if (toggleBtn && advancedToolbar) {
    // Load saved state
    chrome.storage.local.get(['advancedToolbarVisible'], (result) => {
      if (result.advancedToolbarVisible) {
        advancedToolbar.classList.remove('hidden');
        toggleBtn.classList.add('active');
      }
    });
    
    toggleBtn.addEventListener('click', () => {
      const isHidden = advancedToolbar.classList.toggle('hidden');
      toggleBtn.classList.toggle('active', !isHidden);
      
      // Save state
      chrome.storage.local.set({ advancedToolbarVisible: !isHidden });
    });
  }
}

// Auto-save functionality
function initAutoSave() {
  // Save on editor changes
  if (editor) {
    editor.addEventListener('input', () => {
      clearTimeout(autoSaveTimer);
      autoSaveTimer = setTimeout(saveContent, 1000); // Save after 1 second of inactivity
    });
  }
  
  // Save on subject changes
  if (emailSubject) {
    emailSubject.addEventListener('input', () => {
      clearTimeout(autoSaveTimer);
      autoSaveTimer = setTimeout(saveContent, 1000);
    });
  }
  
  // Save before closing
  window.addEventListener('beforeunload', saveContent);
}

// Save content to storage
function saveContent() {
  const data = {
    subject: emailSubject ? emailSubject.value : '',
    content: editor ? editor.innerHTML : '',
    lastSaved: Date.now(),
    // Save email background and document settings
    emailBgColor: emailBgColor,
    emailBgImage: emailBgImage,
    emailBgImageRepeat: emailBgImageRepeat,
    emailBgImageSize: emailBgImageSize,
    emailDirection: emailDirection,
    emailLanguage: emailLanguage
  };
  
  chrome.storage.local.set({ editorData: data });
}

// Load saved content
function loadSavedContent() {
  chrome.storage.local.get(['editorData'], (result) => {
    if (result.editorData) {
      const data = result.editorData;
      
      // Load subject
      if (data.subject && emailSubject) {
        emailSubject.value = data.subject;
      }
      
      // Load content
      if (editor) {
        if (data.content && data.content.trim() !== '' && data.content !== '<p></p>') {
          editor.innerHTML = data.content;
        } else {
          editor.innerHTML = '<p>התחל לכתוב את ההודעה שלך כאן...</p>';
        }
      }
      
      // Load email background and document settings
      if (data.emailBgColor !== undefined) {
        emailBgColor = data.emailBgColor;
      }
      if (data.emailBgImage !== undefined) {
        emailBgImage = data.emailBgImage;
      }
      if (data.emailBgImageRepeat !== undefined) {
        emailBgImageRepeat = data.emailBgImageRepeat;
      }
      if (data.emailBgImageSize !== undefined) {
        emailBgImageSize = data.emailBgImageSize;
      }
      if (data.emailDirection !== undefined) {
        emailDirection = data.emailDirection;
      }
      if (data.emailLanguage !== undefined) {
        emailLanguage = data.emailLanguage;
      }
      
      // Update editor direction
      if (editor) {
        editor.setAttribute('dir', emailDirection);
      }
      
      // Update direction icon if button exists
      const directionIcon = document.getElementById('directionIcon');
      if (directionIcon) {
        if (emailDirection === 'rtl') {
          directionIcon.innerHTML = '<path d="M9 10v5h2v-2h2v-2h-2V9H9v1zm6-1v2h-2v2h2v2h2V9h-2zm-4 8H3v-2h8v2zm0-4H3v-2h8v2zm0-4H3V7h8v2zm10-4v2h-4V6h4zm0 4v2h-4v-2h4zm0 4v2h-4v-2h4z"/>';
        } else {
          directionIcon.innerHTML = '<path d="M15 10v5h-2v-2h-2v-2h2V9h2v1zm-6-1v2h2v2h-2v2H7V9h2zm4 8h8v-2h-8v2zm0-4h8v-2h-8v2zm0-4h8V7h-8v2zm-10-4v2h4V6H3zm0 4v2h4v-2H3zm0 4v2h4v-2H3z"/>';
        }
      }
      
      // Update language display if button exists
      const currentLanguageCode = document.getElementById('currentLanguageCode');
      if (currentLanguageCode) {
        currentLanguageCode.textContent = emailLanguage;
      }
      
      // Update preview with loaded settings
      updatePreview();
      
      // Initialize text boxes after loading
      setTimeout(() => {
        initAllWordTextBoxes();
      }, 100);
      
      // Show last saved time
      if (data.lastSaved) {
        // Content loaded from saved state
      }
    } else if (editor) {
      editor.innerHTML = '<p>התחל לכתוב את ההודעה שלך כאן...</p>';
    }
  });
}

// ===========================================
// KEYBOARD SHORTCUTS HELP
// ===========================================
function initShortcutsHelp() {
  const shortcutsBtn = document.getElementById('shortcutsHelp');
  if (!shortcutsBtn) return;
  
  shortcutsBtn.addEventListener('click', () => {
    openModal('shortcutsModal');
  });
  
  // Close button
  document.getElementById('closeShortcutsModal')?.addEventListener('click', () => {
    closeModal('shortcutsModal');
  });
}

// ===========================================
// THEME TOGGLE (Dark/Light Mode)
// ===========================================
function initThemeToggle() {
  const themeToggle = document.getElementById('themeToggle');
  if (!themeToggle) return;
  
  // Load saved theme
  chrome.storage.local.get(['theme'], (result) => {
    if (result.theme === 'light') {
      document.documentElement.classList.add('light-mode');
    }
  });
  
  themeToggle.addEventListener('click', () => {
    document.documentElement.classList.toggle('light-mode');
    const isLight = document.documentElement.classList.contains('light-mode');
    chrome.storage.local.set({ theme: isLight ? 'light' : 'dark' });
  });
}

// ===========================================
// EMOJI PICKER
// ===========================================
const emojis = {
  smileys: ['😀', '😃', '😄', '😁', '😊', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙', '🥲', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '🥸', '😎', '🤓', '🧐'],
  gestures: ['👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✍️', '💪', '🦾', '🦿', '🦵', '🦶', '👂', '🦻', '👃', '🧠', '👀', '👁️', '👅', '👄', '💋', '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔'],
  symbols: ['✅', '❌', '⭐', '🌟', '💫', '⚡', '🔥', '💥', '❄️', '🌈', '☀️', '🌙', '⭕', '❗', '❓', '‼️', '⁉️', '💯', '🔴', '🟠', '🟡', '🟢', '🔵', '🟣', '⚫', '⚪', '🟤', '🔶', '🔷', '🔸', '🔹', '🔺', '🔻', '💠', '🔘', '🔲', '🔳', '⬛', '⬜', '◼️', '◻️', '◾', '◽', '▪️', '▫️', '🔈', '🔇', '🔉', '🔊', '🔔', '🔕', '📣', '📢', '💬', '💭'],
  objects: ['📧', '📨', '📩', '📤', '📥', '📦', '📫', '📪', '📬', '📭', '📮', '📝', '💼', '📁', '📂', '🗂️', '📅', '📆', '📇', '📈', '📉', '📊', '📋', '📌', '📍', '📎', '🖇️', '📏', '📐', '✂️', '🗃️', '🗄️', '🗑️', '🔒', '🔓', '🔏', '🔐', '🔑', '🗝️', '🔨', '🪓', '⛏️', '⚒️', '🛠️', '🗡️', '⚔️', '🔫', '🪃', '🏹', '🛡️', '🪚', '🔧', '🪛', '🔩', '⚙️']
};

function initEmojiPicker() {
  const emojiBtn = document.getElementById('emojiPickerBtn');
  const emojiMenu = document.getElementById('emojiDropdownMenu');
  if (!emojiBtn || !emojiMenu) return;
  
  // Populate emoji grids
  populateEmojiGrid('emojiGridSmileys', emojis.smileys);
  populateEmojiGrid('emojiGridGestures', emojis.gestures);
  populateEmojiGrid('emojiGridSymbols', emojis.symbols);
  populateEmojiGrid('emojiGridObjects', emojis.objects);
  
  // Toggle dropdown
  emojiBtn.addEventListener('mousedown', (e) => {
    e.preventDefault();
    saveSelection();
  });
  
  emojiBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    emojiMenu.classList.toggle('show');
  });
  
  // Close on outside click
  document.addEventListener('click', () => {
    emojiMenu.classList.remove('show');
  });
  
  emojiMenu.addEventListener('click', (e) => e.stopPropagation());
}

function populateEmojiGrid(gridId, emojiList) {
  const grid = document.getElementById(gridId);
  if (!grid) return;
  
  grid.innerHTML = emojiList.map(emoji => 
    `<button class="emoji-btn" data-emoji="${emoji}">${emoji}</button>`
  ).join('');
  
  grid.querySelectorAll('.emoji-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      restoreSelection();
      editor.focus();
      document.execCommand('insertText', false, btn.dataset.emoji);
      document.getElementById('emojiDropdownMenu').classList.remove('show');
    });
  });
}

// ===========================================
// PREVIEW MODES (Desktop/Mobile)
// ===========================================
function initPreviewModes() {
  const desktopBtn = document.getElementById('previewDesktop');
  const mobileBtn = document.getElementById('previewMobile');
  const previewContainer = document.getElementById('previewFrameContainer');
  
  if (!desktopBtn || !mobileBtn || !previewContainer) return;
  
  desktopBtn.addEventListener('click', () => {
    desktopBtn.classList.add('active');
    mobileBtn.classList.remove('active');
    previewContainer.classList.remove('mobile-view');
    document.getElementById('previewFrame').style.maxWidth = '';
    document.getElementById('previewFrame').style.margin = '';
  });
  
  mobileBtn.addEventListener('click', () => {
    mobileBtn.classList.add('active');
    desktopBtn.classList.remove('active');
    previewContainer.classList.add('mobile-view');
    document.getElementById('previewFrame').style.maxWidth = '375px';
    document.getElementById('previewFrame').style.margin = '0 auto';
  });
}

// ===========================================
// WORD COUNTER
// ===========================================
function initWordCounter() {
  if (!editor) return;
  
  const updateCounter = () => {
    const text = editor.innerText || '';
    const cleanText = text.replace(/\s+/g, ' ').trim();
    
    const wordCount = cleanText ? cleanText.split(/\s+/).length : 0;
    const charCount = cleanText.length;
    
    const wordEl = document.getElementById('wordCount');
    const charEl = document.getElementById('charCount');
    
    if (wordEl) wordEl.textContent = wordCount;
    if (charEl) charEl.textContent = charCount;
  };
  
  editor.addEventListener('input', updateCounter);
  updateCounter();
}

// ===========================================
// QR CODE GENERATOR
// ===========================================
function initQrCode() {
  const insertQrBtn = document.getElementById('insertQrCode');
  if (!insertQrBtn) return;
  
  insertQrBtn.addEventListener('click', () => {
    saveSelection();
    openModal('qrModal');
    updateQrPreview();
  });
  
  const qrContent = document.getElementById('qrContent');
  const qrSize = document.getElementById('qrSize');
  
  if (qrContent) {
    qrContent.addEventListener('input', updateQrPreview);
  }
  if (qrSize) {
    qrSize.addEventListener('input', updateQrPreview);
  }
  
  document.getElementById('confirmQr')?.addEventListener('click', () => {
    const content = document.getElementById('qrContent').value;
    const size = document.getElementById('qrSize').value || 150;
    
    if (!content) {
      showToast('יש להזין תוכן ל-QR', 'error');
      return;
    }
    
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(content)}`;
    
    editor.focus();
    restoreSelection();
    document.execCommand('insertHTML', false, `<img src="${qrUrl}" alt="QR Code" style="display: block; margin: 10px 0;">`);
    
    closeModal('qrModal');
    document.getElementById('qrContent').value = '';
  });
  
  document.getElementById('cancelQr')?.addEventListener('click', () => {
    closeModal('qrModal');
  });
}

function updateQrPreview() {
  const content = document.getElementById('qrContent')?.value || 'https://example.com';
  const size = document.getElementById('qrSize')?.value || 150;
  const preview = document.getElementById('qrPreview');
  
  if (preview && content) {
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(content)}`;
    preview.innerHTML = `<img src="${qrUrl}" alt="QR Preview">`;
  }
}

// ===========================================
// GOOGLE MAP
// ===========================================
function initMapModal() {
  const insertMapBtn = document.getElementById('insertMap');
  if (!insertMapBtn) return;
  
  insertMapBtn.addEventListener('click', () => {
    saveSelection();
    openModal('mapModal');
  });
  
  document.getElementById('confirmMap')?.addEventListener('click', () => {
    const address = document.getElementById('mapAddress').value;
    const zoom = document.getElementById('mapZoom').value || 15;
    const width = document.getElementById('mapWidth').value || 400;
    const height = Math.round(width * 0.6);
    
    if (!address) {
      showToast('יש להזין כתובת', 'error');
      return;
    }
    
    // Using OpenStreetMap static image API
    const mapUrl = `https://maps.google.com/maps?q=${encodeURIComponent(address)}&t=m&z=${zoom}&output=embed`;
    const mapHtml = `<div style="margin: 15px 0;">
      <iframe 
        width="${width}" 
        height="${height}" 
        style="border:0; border-radius: 8px; max-width: 100%;" 
        loading="lazy" 
        allowfullscreen 
        referrerpolicy="no-referrer-when-downgrade"
        src="${mapUrl}">
      </iframe>
      <p style="font-size: 12px; color: #666; margin-top: 5px;">📍 ${address}</p>
    </div>`;
    
    editor.focus();
    restoreSelection();
    document.execCommand('insertHTML', false, mapHtml);
    
    closeModal('mapModal');
    document.getElementById('mapAddress').value = '';
  });
  
  document.getElementById('cancelMap')?.addEventListener('click', () => {
    closeModal('mapModal');
  });
}

// ===========================================
// SOCIAL BUTTONS
// ===========================================
function initSocialButtons() {
  const insertSocialBtn = document.getElementById('insertSocial');
  if (!insertSocialBtn) return;
  
  insertSocialBtn.addEventListener('click', () => {
    saveSelection();
    // Clear all inputs when opening
    document.querySelectorAll('.social-link-input').forEach(input => input.value = '');
    openModal('socialModal');
  });
  
  document.getElementById('confirmSocial')?.addEventListener('click', () => {
    const style = document.getElementById('socialStyle').value;
    
    const socialData = {
      facebook: { name: 'Facebook', color: '#1877F2', icon: 'f' },
      twitter: { name: 'X', color: '#000000', icon: '𝕏' },
      instagram: { name: 'Instagram', color: '#E1306C', icon: '📷' },
      linkedin: { name: 'LinkedIn', color: '#0A66C2', icon: 'in' },
      whatsapp: { name: 'WhatsApp', color: '#25D366', icon: '💬' },
      youtube: { name: 'YouTube', color: '#FF0000', icon: '▶' },
      telegram: { name: 'Telegram', color: '#0088CC', icon: '✈' },
      tiktok: { name: 'TikTok', color: '#000000', icon: '♪' }
    };
    
    // Collect all filled inputs
    const filledLinks = [];
    document.querySelectorAll('.social-link-group').forEach(group => {
      const social = group.dataset.social;
      const input = group.querySelector('.social-link-input');
      let url = input.value.trim();
      
      if (url) {
        // For WhatsApp, create wa.me link
        if (social === 'whatsapp' && !url.startsWith('http')) {
          url = `https://wa.me/${url.replace(/\D/g, '')}`;
        }
        // Ensure URL has protocol
        if (!url.startsWith('http')) {
          url = 'https://' + url;
        }
        filledLinks.push({ social, url, ...socialData[social] });
      }
    });
    
    if (filledLinks.length === 0) {
      showToast(msg('enterAtLeastOneLink') || 'הזן לפחות קישור אחד', 'error');
      return;
    }
    
    let html = '<div style="text-align: center; margin: 15px 0;">';
    
    filledLinks.forEach(link => {
      if (style === 'colored') {
        html += `<a href="${link.url}" target="_blank" style="display: inline-block; padding: 10px 20px; margin: 4px; background: ${link.color}; color: white; text-decoration: none; border-radius: 6px; font-weight: 500;">${link.name}</a>`;
      } else if (style === 'rounded') {
        html += `<a href="${link.url}" target="_blank" style="display: inline-flex; align-items: center; justify-content: center; width: 40px; height: 40px; margin: 4px; background: ${link.color}; color: white; text-decoration: none; border-radius: 50%; font-size: 18px;">${link.icon}</a>`;
      } else {
        html += `<a href="${link.url}" target="_blank" style="display: inline-block; padding: 8px 16px; margin: 4px; border: 1px solid ${link.color}; color: ${link.color}; text-decoration: none; border-radius: 4px;">${link.name}</a>`;
      }
    });
    
    html += '</div>';
    
    editor.focus();
    restoreSelection();
    document.execCommand('insertHTML', false, html);
    
    closeModal('socialModal');
    showToast(msg('socialButtonsAdded') || 'כפתורי הרשתות נוספו!', 'success');
  });
  
  document.getElementById('cancelSocial')?.addEventListener('click', () => {
    closeModal('socialModal');
  });
}

// ===========================================
// SIGNATURE MANAGER
// ===========================================
function initSignatureManager() {
  const insertSignatureBtn = document.getElementById('insertSignature');
  if (!insertSignatureBtn) return;
  
  insertSignatureBtn.addEventListener('click', () => {
    saveSelection();
    loadSignatures();
    openModal('signatureModal');
  });
  
  document.getElementById('createSignatureBtn')?.addEventListener('click', () => {
    document.getElementById('signatureModalTitle').textContent = msg('createSignature');
    document.getElementById('signatureName').value = '';
    document.getElementById('signatureEditor').innerHTML = '';
    document.getElementById('editSignatureId').value = '';
    closeModal('signatureModal');
    openModal('editSignatureModal');
  });
  
  document.getElementById('saveSignature')?.addEventListener('click', () => {
    const name = document.getElementById('signatureName').value.trim();
    const content = document.getElementById('signatureEditor').innerHTML;
    const editId = document.getElementById('editSignatureId').value;
    
    if (!name) {
      showToast('יש להזין שם לחתימה', 'error');
      return;
    }
    
    chrome.storage.local.get(['signatures'], (result) => {
      const signatures = result.signatures || {};
      const id = editId || `sig_${Date.now()}`;
      
      signatures[id] = { name, content, created: Date.now() };
      
      chrome.storage.local.set({ signatures }, () => {
        showToast('החתימה נשמרה!', 'success');
        closeModal('editSignatureModal');
        openModal('signatureModal');
        loadSignatures();
      });
    });
  });
  
  document.getElementById('cancelEditSignature')?.addEventListener('click', () => {
    closeModal('editSignatureModal');
    openModal('signatureModal');
  });
  
  document.getElementById('closeSignatureModal')?.addEventListener('click', () => {
    closeModal('signatureModal');
  });
  
  // Variable chips
  document.querySelectorAll('.variable-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const sigEditor = document.getElementById('signatureEditor');
      if (sigEditor) {
        sigEditor.focus();
        document.execCommand('insertText', false, chip.dataset.var);
      }
    });
  });
}

function loadSignatures() {
  const list = document.getElementById('signaturesList');
  const noSig = document.getElementById('noSignatures');
  
  chrome.storage.local.get(['signatures'], (result) => {
    const signatures = result.signatures || {};
    const ids = Object.keys(signatures);
    
    list.querySelectorAll('.signature-item').forEach(item => item.remove());
    
    if (ids.length === 0) {
      if (noSig) noSig.style.display = 'block';
      return;
    }
    
    if (noSig) noSig.style.display = 'none';
    
    ids.forEach(id => {
      const sig = signatures[id];
      const item = document.createElement('div');
      item.className = 'signature-item';
      item.innerHTML = `
        <span class="signature-item-name">${sig.name}</span>
        <div class="signature-item-actions">
          <button class="signature-action-btn edit" title="ערוך">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
          <button class="signature-action-btn delete" title="מחק">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
          </button>
        </div>
      `;
      
      // Insert signature on click
      item.addEventListener('click', (e) => {
        if (e.target.closest('.signature-item-actions')) return;
        
        // Replace all variables using the new system
        let content = replaceVariables(sig.content);
        
        editor.focus();
        restoreSelection();
        document.execCommand('insertHTML', false, `<div style="margin-top: 20px; border-top: 1px solid #eee; padding-top: 15px;">${content}</div>`);
        closeModal('signatureModal');
        showToast(msg('signatureInserted') || 'החתימה הוכנסה!', 'success');
      });
      
      // Edit button
      item.querySelector('.edit').addEventListener('click', () => {
        document.getElementById('signatureModalTitle').textContent = msg('editSignature') || 'Edit Signature';
        document.getElementById('signatureName').value = sig.name;
        document.getElementById('signatureEditor').innerHTML = sig.content;
        document.getElementById('editSignatureId').value = id;
        closeModal('signatureModal');
        openModal('editSignatureModal');
      });
      
      // Delete button
      item.querySelector('.delete').addEventListener('click', () => {
        if (confirm(`למחוק את החתימה "${sig.name}"?`)) {
          delete signatures[id];
          chrome.storage.local.set({ signatures }, () => {
            showToast('החתימה נמחקה', 'success');
            loadSignatures();
          });
        }
      });
      
      list.appendChild(item);
    });
  });
}

// ===========================================
// ADVANCED TABLE EDITOR
// ===========================================
let selectedTable = null;

function initAdvancedTableEditor() {
  // Double-click on table to edit
  editor?.addEventListener('dblclick', (e) => {
    const table = e.target.closest('table');
    if (table) {
      selectedTable = table;
      openModal('tableEditorModal');
    }
  });
  
  document.getElementById('tableAddRow')?.addEventListener('click', () => {
    if (!selectedTable) return;
    const row = selectedTable.insertRow(-1);
    const cols = selectedTable.rows[0]?.cells.length || 3;
    for (let i = 0; i < cols; i++) {
      const cell = row.insertCell(-1);
      cell.style.cssText = 'border: 1px solid #e5e7eb; padding: 10px; text-align: right;';
      cell.textContent = 'תוכן';
    }
  });
  
  document.getElementById('tableAddCol')?.addEventListener('click', () => {
    if (!selectedTable) return;
    for (let i = 0; i < selectedTable.rows.length; i++) {
      const cell = selectedTable.rows[i].insertCell(-1);
      cell.style.cssText = 'border: 1px solid #e5e7eb; padding: 10px; text-align: right;';
      cell.textContent = i === 0 ? 'כותרת' : 'תוכן';
      if (i === 0) cell.style.background = '#f9fafb';
    }
  });
  
  document.getElementById('tableDeleteRow')?.addEventListener('click', () => {
    if (!selectedTable || selectedTable.rows.length <= 1) return;
    selectedTable.deleteRow(-1);
  });
  
  document.getElementById('tableDeleteCol')?.addEventListener('click', () => {
    if (!selectedTable) return;
    const cols = selectedTable.rows[0]?.cells.length;
    if (cols <= 1) return;
    for (let i = 0; i < selectedTable.rows.length; i++) {
      selectedTable.rows[i].deleteCell(-1);
    }
  });
  
  document.getElementById('tableMergeCells')?.addEventListener('click', () => {
    showToast('בחר תאים בטבלה למיזוג', 'info');
  });
  
  document.getElementById('applyTableChanges')?.addEventListener('click', () => {
    if (!selectedTable) return;
    
    const cellBg = document.getElementById('tableCellBg').value;
    const headerBg = document.getElementById('tableHeaderBg').value;
    
    for (let i = 0; i < selectedTable.rows.length; i++) {
      for (let j = 0; j < selectedTable.rows[i].cells.length; j++) {
        const cell = selectedTable.rows[i].cells[j];
        if (i === 0) {
          cell.style.background = headerBg;
        } else {
          cell.style.background = cellBg;
        }
      }
    }
    
    closeModal('tableEditorModal');
    showToast('הטבלה עודכנה!', 'success');
  });
  
  document.getElementById('cancelTableEditor')?.addEventListener('click', () => {
    closeModal('tableEditorModal');
  });
}

// ===========================================
// AI FEATURES - Gemini & OpenAI Integration
// ===========================================
let geminiApiKey = '';
let openaiApiKey = '';
let currentAiProvider = 'gemini'; // 'gemini' or 'openai'
let apiKeyValidated = false;

async function initAIFeatures() {
  // Load saved API keys and provider
  const result = await chrome.storage.local.get(['geminiApiKey', 'openaiApiKey', 'aiProvider']);
  
  if (result.geminiApiKey) {
    geminiApiKey = result.geminiApiKey;
    document.getElementById('geminiApiKey').value = geminiApiKey;
  }
  
  if (result.openaiApiKey) {
    openaiApiKey = result.openaiApiKey;
    document.getElementById('openaiApiKey').value = openaiApiKey;
  }
  
  if (result.aiProvider) {
    currentAiProvider = result.aiProvider;
  }
  
  // Validate the saved key for current provider
  await validateCurrentProvider();
  
  // AI Provider tabs
  document.querySelectorAll('.ai-provider-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const provider = tab.dataset.provider;
      
      // Update tabs UI
      document.querySelectorAll('.ai-provider-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      // Show/hide key sections
      document.getElementById('geminiKeySection').classList.toggle('hidden', provider !== 'gemini');
      document.getElementById('openaiKeySection').classList.toggle('hidden', provider !== 'openai');
      
      // Update current provider
      currentAiProvider = provider;
      
      // Hide error
      document.getElementById('apiErrorMessage')?.classList.add('hidden');
    });
  });
  
  // Set initial tab state
  updateProviderTabUI();
  
  // Toggle password visibility for both inputs
  document.querySelectorAll('.toggle-password-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.dataset.target;
      const input = document.getElementById(targetId);
      const eyeIcon = btn.querySelector('.eye-icon');
      const eyeOffIcon = btn.querySelector('.eye-off-icon');
      
      if (input.type === 'password') {
        input.type = 'text';
        eyeIcon.style.display = 'none';
        eyeOffIcon.style.display = 'block';
      } else {
        input.type = 'password';
        eyeIcon.style.display = 'block';
        eyeOffIcon.style.display = 'none';
      }
    });
  });
  
  // Save API Key - validates before saving
  document.getElementById('saveApiKey')?.addEventListener('click', async () => {
    const errorMessage = document.getElementById('apiErrorMessage');
    const loading = document.getElementById('apiKeyLoading');
    const saveBtn = document.getElementById('saveApiKey');
    
    const apiKey = currentAiProvider === 'gemini' 
      ? document.getElementById('geminiApiKey').value.trim()
      : document.getElementById('openaiApiKey').value.trim();
    
    if (!apiKey) {
      errorMessage.classList.remove('hidden');
      return;
    }
    
    // Show loading, hide error
    errorMessage.classList.add('hidden');
    loading.classList.remove('hidden');
    saveBtn.disabled = true;
    
    try {
      const isValid = currentAiProvider === 'gemini' 
        ? await testGeminiApiKey(apiKey)
        : await testOpenAIApiKey(apiKey);
      
      if (isValid) {
        // Save the key and provider
        if (currentAiProvider === 'gemini') {
          geminiApiKey = apiKey;
          await chrome.storage.local.set({ geminiApiKey: apiKey, aiProvider: 'gemini' });
        } else {
          openaiApiKey = apiKey;
          await chrome.storage.local.set({ openaiApiKey: apiKey, aiProvider: 'openai' });
        }
        
        apiKeyValidated = true;
        
        loading.classList.add('hidden');
        saveBtn.disabled = false;
        
        closeModal('aiSettingsModal');
        showToast(msg('apiKeySaved') || 'מפתח ה-API נשמר!', 'success');
        
        // Open AI Write modal
        openModal('aiWriteModal');
      } else {
        // Show error, stay in modal
        loading.classList.add('hidden');
        saveBtn.disabled = false;
        errorMessage.classList.remove('hidden');
      }
    } catch (error) {
      loading.classList.add('hidden');
      saveBtn.disabled = false;
      errorMessage.classList.remove('hidden');
    }
  });
  
  // Cancel API Key modal
  document.getElementById('cancelApiKey')?.addEventListener('click', () => {
    document.getElementById('apiErrorMessage')?.classList.add('hidden');
    closeModal('aiSettingsModal');
  });
  
  // AI Write Button - checks if API key is valid
  document.getElementById('aiWriteBtn')?.addEventListener('click', async () => {
    // Set default language based on current language
    const aiLanguageSelect = document.getElementById('aiLanguage');
    if (aiLanguageSelect && currentLang) {
      aiLanguageSelect.value = currentLang;
    }
    
    saveSelection();
    
    const hasValidKey = (currentAiProvider === 'gemini' && geminiApiKey) || 
                        (currentAiProvider === 'openai' && openaiApiKey);
    
    if (!hasValidKey || !apiKeyValidated) {
      // No valid API key - open settings modal
      updateProviderTabUI();
      document.getElementById('apiErrorMessage')?.classList.add('hidden');
      openModal('aiSettingsModal');
    } else {
      // Valid API key - open AI Write modal
      openModal('aiWriteModal');
    }
  });
  
  // Change API Key button (in AI Write modal)
  document.getElementById('changeApiKeyBtn')?.addEventListener('click', () => {
    closeModal('aiWriteModal');
    updateProviderTabUI();
    document.getElementById('apiErrorMessage')?.classList.add('hidden');
    openModal('aiSettingsModal');
  });
  
  // Generate AI Email
  document.getElementById('generateAiEmail')?.addEventListener('click', async () => {
    const instructions = document.getElementById('aiInstructions').value.trim();
    const tone = document.getElementById('aiTone').value;
    const language = document.getElementById('aiLanguage').value;
    
    if (!instructions) {
      showToast(msg('enterInstructions') || 'הזן הוראות לכתיבת המייל', 'error');
      return;
    }
    
    const hasKey = (currentAiProvider === 'gemini' && geminiApiKey) || 
                   (currentAiProvider === 'openai' && openaiApiKey);
    
    if (!hasKey) {
      showToast(msg('configureApiFirst') || 'יש להגדיר מפתח API קודם', 'error');
      return;
    }
    
    // Show loading
    document.getElementById('aiLoading').classList.remove('hidden');
    document.getElementById('generateAiEmail').disabled = true;
    
    try {
      const emailContent = currentAiProvider === 'gemini'
        ? await generateEmailWithGemini(instructions, tone, language)
        : await generateEmailWithOpenAI(instructions, tone, language);
      
      if (emailContent) {
        // Insert into editor
        editor.focus();
        restoreSelection();
        
        // If editor is empty, just set the content
        if (!editor.innerHTML || editor.innerHTML === '<br>') {
          editor.innerHTML = emailContent;
        } else {
          document.execCommand('insertHTML', false, emailContent);
        }
        
        closeModal('aiWriteModal');
        document.getElementById('aiInstructions').value = '';
        showToast(msg('emailGenerated') || 'המייל נוצר בהצלחה!', 'success');
      }
    } catch (error) {
      // Show appropriate error message
      if (error.message === 'RATE_LIMIT') {
        showToast(msg('rateLimitError') || 'יותר מדי בקשות. נסה שוב בעוד דקה', 'error');
      } else {
        showToast(msg('aiGenerationError') || 'שגיאה ביצירת המייל', 'error');
      }
    } finally {
      document.getElementById('aiLoading').classList.add('hidden');
      document.getElementById('generateAiEmail').disabled = false;
    }
  });
  
  // Cancel AI Write
  document.getElementById('cancelAiWrite')?.addEventListener('click', () => {
    closeModal('aiWriteModal');
  });
}

function updateProviderTabUI() {
  // Update tabs
  document.querySelectorAll('.ai-provider-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.provider === currentAiProvider);
  });
  
  // Show/hide sections
  document.getElementById('geminiKeySection')?.classList.toggle('hidden', currentAiProvider !== 'gemini');
  document.getElementById('openaiKeySection')?.classList.toggle('hidden', currentAiProvider !== 'openai');
  
  // Fill in saved keys
  if (geminiApiKey) {
    document.getElementById('geminiApiKey').value = geminiApiKey;
  }
  if (openaiApiKey) {
    document.getElementById('openaiApiKey').value = openaiApiKey;
  }
}

async function validateCurrentProvider() {
  try {
    if (currentAiProvider === 'gemini' && geminiApiKey) {
      apiKeyValidated = await testGeminiApiKey(geminiApiKey);
      if (!apiKeyValidated) geminiApiKey = '';
    } else if (currentAiProvider === 'openai' && openaiApiKey) {
      apiKeyValidated = await testOpenAIApiKey(openaiApiKey);
      if (!apiKeyValidated) openaiApiKey = '';
    } else {
      apiKeyValidated = false;
    }
  } catch (e) {
    apiKeyValidated = false;
  }
}


async function testGeminiApiKey(apiKey) {
  try {
    // First try a simple models list request (lighter than generation)
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
      {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      }
    );
    
    if (response.ok) {
      return true;
    }
    
    // Check specific error codes
    if (response.status === 400 || response.status === 401 || response.status === 403) {
      return false;
    }
    
    return false;
  } catch (error) {
    // Network errors might be CORS related, but in extensions should work
    return false;
  }
}

async function generateEmailWithGemini(instructions, tone, language) {
  const languageNames = {
    'he': 'Hebrew',
    'en': 'English',
    'es': 'Spanish',
    'fr': 'French',
    'de': 'German',
    'ru': 'Russian',
    'ar': 'Arabic',
    'pt': 'Portuguese',
    'zh_CN': 'Chinese'
  };
  
  const toneDescriptions = {
    'professional': 'professional and business-appropriate',
    'friendly': 'warm and friendly',
    'formal': 'very formal and respectful',
    'casual': 'casual and relaxed'
  };
  
  const systemPrompt = `You are an expert email writer. Write a well-structured email based on the user's instructions.

IMPORTANT RULES:
1. Write the email ONLY in ${languageNames[language] || 'English'}
2. Use a ${toneDescriptions[tone] || 'professional'} tone
3. Format the email with proper HTML for email clients:
   - Use <p> tags for paragraphs
   - Use <br> for line breaks where needed
   - Use proper greeting and closing
4. Return ONLY the email body HTML, no explanations
5. Do NOT include subject line in the output
6. Make sure the email is complete and ready to send
7. If the language is RTL (Hebrew, Arabic), add dir="rtl" to the main container`;

  const userPrompt = `Write an email based on these instructions: ${instructions}`;
  
  try {
    
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: systemPrompt + '\n\n' + userPrompt }]
          }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1024
          }
        })
      }
    );
        
if (!response.ok) {
        // Handle rate limit error specifically
        if (response.status === 429) {
          throw new Error('RATE_LIMIT');
        }
        throw new Error(`API request failed: ${response.status}`);
      }
    
    const data = await response.json();
    let content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    // Clean up markdown code blocks if present
    content = content.replace(/```html\n?/gi, '').replace(/```\n?/g, '');
    
    // Wrap in a div if needed
    if (!content.startsWith('<')) {
      content = `<div>${content.replace(/\n/g, '<br>')}</div>`;
    }
    
    return content;
  } catch (error) {
    throw error;
  }
}

// OpenAI API Functions
async function testOpenAIApiKey(apiKey) {
  try {
    const response = await fetch('https://api.openai.com/v1/models', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    return response.ok;
  } catch (error) {
    return false;
  }
}

async function generateEmailWithOpenAI(instructions, tone, language) {
  const languageNames = {
    'he': 'Hebrew',
    'en': 'English',
    'es': 'Spanish',
    'fr': 'French',
    'de': 'German',
    'ru': 'Russian',
    'ar': 'Arabic',
    'pt': 'Portuguese',
    'zh_CN': 'Chinese'
  };
  
  const toneDescriptions = {
    'professional': 'professional and business-appropriate',
    'friendly': 'warm and friendly',
    'formal': 'very formal and respectful',
    'casual': 'casual and relaxed'
  };
  
  const systemPrompt = `You are an expert email writer. Write a well-structured email based on the user's instructions.

IMPORTANT RULES:
1. Write the email ONLY in ${languageNames[language] || 'English'}
2. Use a ${toneDescriptions[tone] || 'professional'} tone
3. Format the email with proper HTML for email clients:
   - Use <p> tags for paragraphs
   - Use <br> for line breaks where needed
   - Use proper greeting and closing
4. Return ONLY the email body HTML, no explanations
5. Do NOT include subject line in the output
6. Make sure the email is complete and ready to send
7. If the language is RTL (Hebrew, Arabic), add dir="rtl" to the main container`;

  const userPrompt = `Write an email based on these instructions: ${instructions}`;
  
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 1024
      })
    });
    
    if (!response.ok) {
      if (response.status === 429) {
        throw new Error('RATE_LIMIT');
      }
      throw new Error(`API request failed: ${response.status}`);
    }
    
    const data = await response.json();
    let content = data.choices?.[0]?.message?.content || '';
    
    // Clean up markdown code blocks if present
    content = content.replace(/```html\n?/gi, '').replace(/```\n?/g, '');
    
    // Wrap in a div if needed
    if (!content.startsWith('<')) {
      content = `<div>${content.replace(/\n/g, '<br>')}</div>`;
    }
    
    return content;
  } catch (error) {
    throw error;
  }
}

// ===========================================
// VARIABLES SYSTEM
// ===========================================
let userVariables = {
  name: '',
  email: '',
  phone: '',
  company: '',
  title: '',
  custom: {} // { varName: varValue }
};

async function initVariables() {
  // Load saved variables
  const result = await chrome.storage.local.get('userVariables');
  if (result.userVariables) {
    userVariables = { ...userVariables, ...result.userVariables };
  }
  
  // Insert Variable button in toolbar
  document.getElementById('insertVariableBtn')?.addEventListener('click', () => {
    saveSelection();
    populateVariablesList();
    openModal('variablesModal');
  });
  
  // Open settings from variables modal
  document.getElementById('openVariablesSettings')?.addEventListener('click', () => {
    closeModal('variablesModal');
    openVariablesSettings();
  });
  
  // Close variables modal
  document.getElementById('closeVariablesModal')?.addEventListener('click', () => {
    closeModal('variablesModal');
  });
  
  // Save variables settings
  document.getElementById('saveVariablesSettings')?.addEventListener('click', () => {
    saveVariablesSettings();
  });
  
  // Cancel variables settings
  document.getElementById('cancelVariablesSettings')?.addEventListener('click', () => {
    closeModal('variablesSettingsModal');
    openModal('variablesModal');
  });
  
  // Add custom variable
  document.getElementById('addCustomVariable')?.addEventListener('click', () => {
    addCustomVariableRow();
  });
  
  // Update signature variable chips to use new system
  updateSignatureVariableChips();
}

function populateVariablesList() {
  const list = document.getElementById('variablesList');
  if (!list) return;
  
  list.innerHTML = '';
  
  // Built-in variables
  const builtInVars = [
    { key: 'name', label: msg('varName') || '{{name}}' },
    { key: 'email', label: msg('varEmail') || '{{email}}' },
    { key: 'phone', label: msg('varPhone') || '{{phone}}' },
    { key: 'company', label: msg('varCompany') || '{{company}}' },
    { key: 'title', label: msg('varTitle') || '{{title}}' },
    { key: 'date', label: msg('varDate') || '{{date}}', isDate: true }
  ];
  
  builtInVars.forEach(v => {
    const value = v.isDate ? new Date().toLocaleDateString() : userVariables[v.key];
    const btn = createVariableButton(`{{${v.key}}}`, value || (msg('notSet') || 'לא הוגדר'));
    list.appendChild(btn);
  });
  
  // Custom variables
  if (userVariables.custom && Object.keys(userVariables.custom).length > 0) {
    Object.entries(userVariables.custom).forEach(([key, value]) => {
      const btn = createVariableButton(`{{${key}}}`, value);
      list.appendChild(btn);
    });
  }
}

function createVariableButton(varKey, varValue) {
  const btn = document.createElement('button');
  btn.className = 'variable-insert-btn';
  btn.innerHTML = `
    <span class="var-key">${varKey}</span>
    <span class="var-value">${varValue}</span>
  `;
  
  btn.addEventListener('click', () => {
    editor.focus();
    restoreSelection();
    document.execCommand('insertText', false, varKey);
    closeModal('variablesModal');
  });
  
  return btn;
}

function openVariablesSettings() {
  // Populate form with current values
  document.getElementById('varNameValue').value = userVariables.name || '';
  document.getElementById('varEmailValue').value = userVariables.email || '';
  document.getElementById('varPhoneValue').value = userVariables.phone || '';
  document.getElementById('varCompanyValue').value = userVariables.company || '';
  document.getElementById('varTitleValue').value = userVariables.title || '';
  
  // Populate custom variables
  populateCustomVariables();
  
  openModal('variablesSettingsModal');
}

function populateCustomVariables() {
  const list = document.getElementById('customVariablesList');
  if (!list) return;
  
  list.innerHTML = '';
  
  if (!userVariables.custom || Object.keys(userVariables.custom).length === 0) {
    list.innerHTML = `<div class="no-custom-variables" data-i18n="noCustomVariables">${msg('noCustomVariables') || 'אין משתנים מותאמים אישית'}</div>`;
    return;
  }
  
  Object.entries(userVariables.custom).forEach(([key, value]) => {
    addCustomVariableRow(key, value);
  });
}

function addCustomVariableRow(key = '', value = '') {
  const list = document.getElementById('customVariablesList');
  if (!list) return;
  
  // Remove "no variables" message if exists
  const noVars = list.querySelector('.no-custom-variables');
  if (noVars) noVars.remove();
  
  const row = document.createElement('div');
  row.className = 'custom-variable-item';
  row.innerHTML = `
    <input type="text" class="custom-var-key" placeholder="${msg('variableName') || 'שם משתנה'}" value="${key}">
    <input type="text" class="custom-var-value" placeholder="${msg('variableValue') || 'ערך'}" value="${value}">
    <button class="delete-variable-btn" title="${msg('delete') || 'מחק'}">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="18" y1="6" x2="6" y2="18"/>
        <line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    </button>
  `;
  
  row.querySelector('.delete-variable-btn').addEventListener('click', () => {
    row.remove();
    // Show "no variables" if list is empty
    if (list.children.length === 0) {
      list.innerHTML = `<div class="no-custom-variables" data-i18n="noCustomVariables">${msg('noCustomVariables') || 'אין משתנים מותאמים אישית'}</div>`;
    }
  });
  
  list.appendChild(row);
  
  // Focus on the key input if new row
  if (!key) {
    row.querySelector('.custom-var-key').focus();
  }
}

async function saveVariablesSettings() {
  // Save built-in variables
  userVariables.name = document.getElementById('varNameValue').value.trim();
  userVariables.email = document.getElementById('varEmailValue').value.trim();
  userVariables.phone = document.getElementById('varPhoneValue').value.trim();
  userVariables.company = document.getElementById('varCompanyValue').value.trim();
  userVariables.title = document.getElementById('varTitleValue').value.trim();
  
  // Save custom variables
  userVariables.custom = {};
  document.querySelectorAll('.custom-variable-item').forEach(row => {
    const key = row.querySelector('.custom-var-key').value.trim();
    const value = row.querySelector('.custom-var-value').value.trim();
    if (key) {
      userVariables.custom[key] = value;
    }
  });
  
  // Save to storage
  await chrome.storage.local.set({ userVariables });
  
  closeModal('variablesSettingsModal');
  populateVariablesList();
  openModal('variablesModal');
  showToast(msg('variablesSaved') || 'המשתנים נשמרו!', 'success');
}

function replaceVariables(content) {
  // Replace built-in variables
  content = content.replace(/\{\{name\}\}/g, userVariables.name || '');
  content = content.replace(/\{\{email\}\}/g, userVariables.email || '');
  content = content.replace(/\{\{phone\}\}/g, userVariables.phone || '');
  content = content.replace(/\{\{company\}\}/g, userVariables.company || '');
  content = content.replace(/\{\{title\}\}/g, userVariables.title || '');
  content = content.replace(/\{\{date\}\}/g, new Date().toLocaleDateString());
  
  // Replace custom variables
  if (userVariables.custom) {
    Object.entries(userVariables.custom).forEach(([key, value]) => {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      content = content.replace(regex, value || '');
    });
  }
  
  return content;
}

function updateSignatureVariableChips() {
  // Update variable chips in signature editor to also include custom variables
  document.querySelectorAll('.variable-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const sigEditor = document.getElementById('signatureEditor');
      if (sigEditor) {
        sigEditor.focus();
        document.execCommand('insertText', false, chip.dataset.var);
      }
    });
  });
}
