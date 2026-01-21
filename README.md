# 📧 Email Designer Pro

A powerful Chrome extension for creating and designing beautiful, professional emails with AI writing assistance.

![Version](https://img.shields.io/badge/version-3.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Chrome](https://img.shields.io/badge/chrome-extension-yellow)

## ✨ Features

### 📝 Visual Editor
- Rich text formatting (bold, italic, underline, strikethrough)
- Multiple font sizes and colors
- Text and background color picker
- Text alignment options
- Subscript and superscript

### 🔗 Rich Content
- Insert links with custom text
- Add images from URL
- Embed YouTube videos
- File attachment links
- Advanced table editor
- QR code generator
- Google Maps embedding
- Social media buttons (Facebook, X, Instagram, LinkedIn, WhatsApp, YouTube, Telegram, TikTok)

### 🤖 AI-Powered Writing
- Write emails using **OpenAI GPT** or **Google Gemini AI**
- Switch between AI providers easily
- Multiple tone options: Professional, Friendly, Formal, Casual
- Generate emails in 9 languages
- Just describe what you want - AI does the rest!

### 📋 Templates & Signatures
- Pre-designed professional templates
- Save custom templates
- Signature manager with multiple signatures
- Quick signature insertion

### 📊 Smart Variables
- Built-in variables: `{{name}}`, `{{email}}`, `{{phone}}`, `{{company}}`, `{{title}}`, `{{date}}`
- Create unlimited custom variables
- Auto-replacement when sending
- Use in emails AND signatures

### 🌍 Multi-Language Support
- 9 languages: English, עברית, Español, Français, Deutsch, Русский, العربية, Português, 中文
- Full RTL support for Hebrew and Arabic

### 🎨 Modern Interface
- Beautiful dark/light mode
- Mobile preview mode
- Real-time HTML code view
- Live preview panel
- Character and word counter
- Emoji picker

### 📤 Seamless Integration
- One-click insert to Gmail
- Works with Outlook (Web, Office 365)
- Yahoo Mail support
- ProtonMail compatible
- Copy HTML to clipboard

## 🚀 Installation

### From Chrome Web Store
1. Visit the [Chrome Web Store](#) (link coming soon)
2. Click "Add to Chrome"
3. Done!

### Manual Installation (Developer Mode)
1. Download or clone this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" (top right)
4. Click "Load unpacked"
5. Select the extension folder
6. Done!

## 📖 Usage

1. Click the extension icon in your browser toolbar
2. Compose your email using the visual editor
3. Use templates, add images, format text as needed
4. Click "Insert to Email" when composing in Gmail/Outlook
5. Your formatted email is inserted automatically!

### Using AI Writing
1. Click the purple "AI" button in the toolbar
2. Choose your AI provider (OpenAI or Gemini)
3. If first time, enter your API key:
   - **OpenAI**: Get your API key from [OpenAI Platform](https://platform.openai.com/api-keys)
   - **Gemini**: Get your API key from [Google AI Studio](https://aistudio.google.com/apikey)
4. Describe the email you want to write
5. Choose tone and language
6. Click "Generate" - your email is ready!

### Using Variables
1. Click the variables button (T icon) in the toolbar
2. Click the settings icon to set up your info
3. Add your name, email, phone, company, title
4. Create custom variables if needed
5. Insert variables into your emails - they auto-replace when sending!

## 🔒 Privacy Policy

### Data Collection
This extension does **NOT** collect, store, or transmit any personal information to external servers.

### Local Storage Only
All data is stored locally on your device using Chrome's built-in storage API:
- User preferences (language, theme)
- Custom email templates
- Signatures
- Variable settings
- OpenAI or Gemini API key (if you choose to use AI features)

### Third-Party Services
- **OpenAI API**: Only used when you explicitly use the AI writing feature with OpenAI. Requires your own API key. We do not store or have access to your conversations with the AI.
- **Google Gemini API**: Only used when you explicitly use the AI writing feature with Gemini. Requires your own API key. We do not store or have access to your conversations with the AI.

### Permissions Explained
| Permission | Why It's Needed |
|------------|-----------------|
| `activeTab` | To detect email compose windows and insert content |
| `storage` | To save your preferences, templates, and signatures locally |
| `clipboardWrite` | To copy HTML to your clipboard |
| `scripting` | To insert formatted content into email compose windows |
| Host permissions | To interact with Gmail, Outlook, Yahoo Mail, ProtonMail, OpenAI API, and Gemini API |

### Data Security
All your data remains on your local device. We have no servers and no way to access your information.

## 🛠️ Development

### Project Structure
```
├── manifest.json        # Extension configuration
├── popup.html          # Main popup interface
├── popup.js            # Popup functionality
├── styles.css          # Styling
├── content.js          # Content script for email insertion
├── content-styles.css  # Content script styles
├── background.js       # Service worker
├── _locales/           # Internationalization
│   ├── en/
│   ├── he/
│   ├── ar/
│   ├── de/
│   ├── es/
│   ├── fr/
│   ├── pt/
│   ├── ru/
│   └── zh_CN/
└── icons/              # Extension icons
```

### Building
No build process required! The extension runs directly from source.

### Contributing
Contributions are welcome! Please feel free to submit a Pull Request.

## 📝 Changelog

### Version 2.0.4
- ✨ Added OpenAI GPT support (in addition to Gemini)
- ✨ Users can now choose between OpenAI and Gemini AI providers
- 🧹 Removed unnecessary console logging for cleaner output
- 🔧 Improved code quality and performance

### Version 2.0.0
- ✨ Added AI writing with Google Gemini
- ✨ Added smart variables system
- ✨ Added signature manager
- ✨ Added QR code generator
- ✨ Added Google Maps embedding
- ✨ Added social media buttons
- ✨ Added dark/light mode toggle
- ✨ Added mobile preview
- ✨ Added emoji picker
- ✨ Added word/character counter
- 🌍 Added 9 language support
- 🎨 Complete UI redesign

### Version 1.0.0
- Initial release
- Basic email designer
- Gmail integration

## 📄 License

MIT License - feel free to use this project for personal or commercial purposes.

## 👨‍💻 Author

Created with ❤️ for better email communication.

## 🙏 Acknowledgments

- OpenAI and Google Gemini AI for powering the AI writing features
- All the open-source libraries and tools that made this possible

---

**⭐ If you find this extension useful, please consider leaving a review on the Chrome Web Store!**

