# AGENTS.md - WhatsApp Bulk Sender Extension

## Project Overview

This is a **Chrome Extension (Manifest V3)** for sending bulk WhatsApp messages with images. It consists of:
- `popup.js` / `popup.html` - Extension popup UI (user interface)
- `content.js` - Content script injected into WhatsApp Web
- `background.js` - Service worker for tab management

The project uses **vanilla JavaScript (ES6+)** with no build system or framework.

---

## Build, Lint & Test Commands

### Running the Extension

1. **Load the extension in Chrome:**
   - Open `chrome://extensions`
   - Enable "Developer mode" (toggle in top-right)
   - Click "Load unpacked"
   - Select the `whatsapp-bulk-extension` folder

2. **Development workflow:**
   - Edit the `.js` or `.html` files directly
   - In Chrome extensions page, click "Reload" on the extension
   - Refresh WhatsApp Web if needed

### No Build System

This project has **no npm/package.json**. There are no:
- `npm run build` commands
- Linting tools (ESLint, Prettier)
- Test frameworks (Jest, Mocha)
- TypeScript

To add these, you would need to set up a Node.js project with appropriate tooling.

### Testing

Manual testing only:
1. Load unpacked extension in Chrome
2. Open WhatsApp Web (web.whatsapp.com)
3. Use the extension UI to send test messages

---

## Code Style Guidelines

### General Rules

- **Language:** Vanilla JavaScript (ES2015+)
- **No TypeScript** - Do not add type annotations or convert to TS
- **No import/export** - Use script tags and global scope (per extension requirements)
- **No build pipeline** - Keep files directly executable in browser

### Naming Conventions

```javascript
// Variables: camelCase
let imageFile = null;
let isSending = false;

// Constants: SCREAMING_SNAKE_CASE (if used)
const DEFAULT_DELAY = 4000;

// Functions: camelCase, descriptive Spanish/English names
async function checkWhatsAppTab() { }
function parsePhones(raw) { }
function sleep(ms) { }

// DOM elements: descriptive suffixes
const phonesEl = document.getElementById('phones');
const messageEl = document.getElementById('message');
const btnSend = document.getElementById('btnSend');
```

### Formatting

- Use **2 spaces** for indentation
- Use **single quotes** for strings (consistent with existing code)
- Use **template literals** for string interpolation: `` `${variable}` ``
- **One var/let/const per line**
- **Trailing commas** in objects/arrays

```javascript
// Good
const tabs = await chrome.tabs.query({ url: 'https://web.whatsapp.com/*' });
if (tabs.length > 0) {
  statusDot.classList.add('connected');
}

// Avoid
const tabs = await chrome.tabs.query({url: 'https://web.whatsapp.com/*'});
if(tabs.length>0){statusDot.classList.add('connected');}
```

### Functions

- Use **async/await** for asynchronous operations
- Keep functions focused and small (< 50 lines)
- Use **promises** for chrome API calls
- Add **timeout fallbacks** for long-running operations

```javascript
function waitForTabLoad(tabId) {
  return new Promise(resolve => {
    function listener(updatedTabId, changeInfo) {
      if (updatedTabId === tabId && changeInfo.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    }
    chrome.tabs.onUpdated.addListener(listener);
    setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    }, 12000);
  });
}
```

### Error Handling

- Always wrap async operations in **try/catch**
- Provide meaningful error messages in user's language (Spanish)
- Log errors to console with context

```javascript
try {
  const result = await sendMessage(tabId, payload);
  if (result && result.success) {
    logMsg('ok', `${phone} — enviado`);
  } else {
    logMsg('err', `${phone} — ${result?.error || 'error desconocido'}`);
  }
} catch (err) {
  logMsg('err', `${phone} — ${err.message}`);
  errors++;
}
```

### Chrome Extension APIs

Use these APIs appropriately:

```javascript
// Tabs
chrome.tabs.query({ url: 'https://web.whatsapp.com/*' })
chrome.tabs.update(tabId, { url })
chrome.tabs.onUpdated.addListener(listener)

// Scripting
chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] })

// Messages
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => { })
chrome.tabs.sendMessage(tabId, { action: 'doSend', ...payload })

// Storage
chrome.storage.local.get([...keys], callback)
chrome.storage.local.set({ key: value })
```

### DOM Manipulation

- Cache DOM elements at the top of the file
- Use **querySelector/querySelectorAll** for element selection
- Use **addEventListener** for events (not inline handlers)
- Use **classList** for CSS class manipulation

```javascript
// Cache elements at top
const phonesEl = document.getElementById('phones');
const messageEl = document.getElementById('message');

// Event listeners
phonesEl.addEventListener('input', () => {
  const phones = parsePhones(phonesEl.value);
  phoneCount.textContent = `${phones.length} número${phones.length !== 1 ? 's' : ''}`;
});
```

### CSS Guidelines

- Use **CSS custom properties** (variables) for colors
- Keep styles inline in `popup.html` (single-file approach)
- Use **flexbox** for layouts
- Follow existing naming patterns: `.section-label`, `.btn-send`, `.progress-fill`

```css
:root {
  --green: #00a884;
  --green-dark: #008069;
  --surface: #111c18;
  --text: #e9edef;
}
```

### Comments

- Use **Spanish comments** (project language)
- Add comments for complex logic or workarounds
- Include version comments at file top

```javascript
// popup.js v1.2 — El popup controla la navegación

// ─── Check WhatsApp tab ───────────────────────────────────────
async function checkWhatsAppTab() { }
```

### WhatsApp Web Specific Patterns

The content script uses **fallback selectors** for WhatsApp UI elements that may change:

```javascript
const selectors = [
  '[data-testid="attach-btn"]',
  'button[aria-label*="Adjuntar"]',
  'button[aria-label*="Attach"]',
  'span[data-icon="plus"]',
];
```

When WhatsApp updates their UI:
1. Add new selectors to the array
2. Test with the debug button in the popup
3. Prefer `data-testid` and `aria-label` over CSS classes (more stable)

---

## Important Notes

1. **No external dependencies** - Keep it that way
2. **Manifest V3** - Service workers replace background pages
3. **WhatsApp Web changes** - The UI selectors may need updates as WhatsApp evolves
4. **Rate limiting** - Always include delays (minimum 2 seconds) between messages
5. **No automation abuse** - This tool is for legitimate bulk messaging use cases

---

## File Structure

```
whatsapp-bulk-sender/
└── whatsapp-bulk-extension/
    ├── manifest.json        # Extension manifest (MV3)
    ├── popup.html           # Extension UI + inline CSS
    ├── popup.js             # Popup logic
    ├── content.js           # WhatsApp Web interaction
    ├── background.js        # Service worker
    ├── icons/               # Extension icons
    └── README.md            # User documentation
```
