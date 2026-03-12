// popup.js v1.2 — El popup controla la navegación, content script solo envía

let imageFile = null;
let isSending = false;
let stopRequested = false;

const phonesEl        = document.getElementById('phones');
const messageBeforeEl  = document.getElementById('messageBefore');
const messageAfterEl   = document.getElementById('messageAfter');
const imageInput      = document.getElementById('imageInput');
const imagePreview    = document.getElementById('imagePreview');
const imageName       = document.getElementById('imageName');
const imageArea       = document.getElementById('imageArea');
const uploadPH        = document.getElementById('uploadPlaceholder');
const btnSend         = document.getElementById('btnSend');
const btnText         = document.getElementById('btnText');
const btnPaste        = document.getElementById('btnPaste');
const btnExcel        = document.getElementById('btnExcel');
const excelInput      = document.getElementById('excelInput');
const phoneCount      = document.getElementById('phoneCount');
const progressSection = document.getElementById('progressSection');
const progressCount   = document.getElementById('progressCount');
const progressFill    = document.getElementById('progressFill');
const currentPhone    = document.getElementById('currentPhone');
const logEl           = document.getElementById('log');
const statusDot       = document.getElementById('statusDot');
const statusText      = document.getElementById('statusText');
const delayInput      = document.getElementById('delay');

// ─── Check WhatsApp tab ───────────────────────────────────────
async function checkWhatsAppTab() {
  const tabs = await chrome.tabs.query({ url: 'https://web.whatsapp.com/*' });
  if (tabs.length > 0) {
    statusDot.classList.add('connected');
    statusText.textContent = 'WhatsApp Web detectado ✓';
  } else {
    statusDot.classList.remove('connected');
    statusText.textContent = 'Abrí WhatsApp Web primero';
  }
}
checkWhatsAppTab();

// ─── Phone parsing ────────────────────────────────────────────
const DEFAULT_COUNTRY_CODE = '+54';

function parsePhones(raw) {
  if (!raw.trim()) return [];
  return raw.split(/[,;\n]+/).map(p => {
    let phone = p.trim().replace(/\s+/g, '');
    if (phone.length > 4) {
      if (!phone.startsWith('+')) {
        if (phone.startsWith('54')) {
          phone = '+' + phone;
        } else if (phone.startsWith('0')) {
          phone = '+54' + phone.substring(1);
        } else {
          phone = DEFAULT_COUNTRY_CODE + phone;
        }
      }
      return phone;
    }
    return null;
  }).filter(p => p !== null);
}
phonesEl.addEventListener('input', () => {
  const phones = parsePhones(phonesEl.value);
  phoneCount.textContent = `${phones.length} número${phones.length !== 1 ? 's' : ''}`;
});

// ─── Paste ────────────────────────────────────────────────────
btnPaste.addEventListener('click', async () => {
  try {
    const text = await navigator.clipboard.readText();
    phonesEl.value = text;
    phonesEl.dispatchEvent(new Event('input'));
    logMsg('info', 'Pegado desde portapapeles');
  } catch { logMsg('err', 'No se pudo acceder al portapapeles'); }
});

// ─── Import CSV/Excel ─────────────────────────────────────────
btnExcel.addEventListener('click', () => excelInput.click());
excelInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    const matches = ev.target.result.match(/\+?[\d\s\-\(\)]{7,20}/g) || [];
    const cleaned = matches.map(p => p.replace(/[\s\-\(\)]/g, '')).filter(p => /^\+?\d{7,15}$/.test(p));
    if (cleaned.length > 0) {
      phonesEl.value = cleaned.join('\n');
      phonesEl.dispatchEvent(new Event('input'));
      logMsg('ok', `${cleaned.length} números importados de ${file.name}`);
    } else {
      logMsg('err', `No se encontraron números en ${file.name}`);
    }
  };
  reader.readAsText(file);
  excelInput.value = '';
});

// ─── Image upload ─────────────────────────────────────────────
imageInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  imageFile = file;
  imagePreview.src = URL.createObjectURL(file);
  imagePreview.style.display = 'block';
  imageName.style.display = 'block';
  imageName.textContent = `📎 ${file.name} (${(file.size / 1024).toFixed(0)} KB)`;
  uploadPH.style.display = 'none';
  imageArea.classList.add('has-image');
});

// ─── Log ──────────────────────────────────────────────────────
function logMsg(type, msg) {
  logEl.classList.add('visible');
  const div = document.createElement('div');
  div.className = `log-${type}`;
  div.textContent = `${{ ok: '✓', err: '✗', info: '·' }[type] || '·'} ${msg}`;
  logEl.appendChild(div);
  logEl.scrollTop = logEl.scrollHeight;
}
function clearLog() { logEl.innerHTML = ''; logEl.classList.remove('visible'); }

// ─── Inject content script ────────────────────────────────────
async function injectContentScript(tabId) {
  await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
  await sleep(300);
}

// ─── Ping content script ──────────────────────────────────────
function pingContentScript(tabId) {
  return new Promise(resolve => {
    chrome.tabs.sendMessage(tabId, { action: 'ping' }, res => {
      resolve(!chrome.runtime.lastError && res && res.alive);
    });
  });
}

// ─── Navigate tab and wait for WhatsApp chat to load ─────────
function navigateTab(tabId, url) {
  return new Promise(resolve => {
    chrome.tabs.update(tabId, { url }, () => resolve());
  });
}

function waitForTabLoad(tabId) {
  return new Promise(resolve => {
    function listener(updatedTabId, changeInfo) {
      if (updatedTabId === tabId && changeInfo.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    }
    chrome.tabs.onUpdated.addListener(listener);
    // Timeout fallback
    setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    }, 12000);
  });
}

// ─── Main send ────────────────────────────────────────────────
btnSend.addEventListener('click', async () => {
  if (isSending) {
    stopRequested = true;
    btnText.textContent = 'Deteniendo...';
    return;
  }

  const phones = parsePhones(phonesEl.value);
  if (phones.length === 0) { logMsg('err', 'Agregá al menos un número'); return; }

  const messageBefore = messageBeforeEl.value.trim();
  const messageAfter = messageAfterEl.value.trim();
  if (!imageFile && !messageBefore && !messageAfter) { logMsg('err', 'Agregá una imagen o un mensaje'); return; }

  const tabs = await chrome.tabs.query({ url: 'https://web.whatsapp.com/*' });
  if (tabs.length === 0) { logMsg('err', 'Abrí WhatsApp Web primero'); return; }

  const tabId = tabs[0].id;
  const delay = Math.max(2, parseInt(delayInput.value) || 4) * 1000;

  const imageBase64   = imageFile ? await fileToBase64(imageFile) : null;
  const imageMimeType = imageFile ? imageFile.type : null;
  const imageFileName = imageFile ? imageFile.name : null;

  isSending = true;
  stopRequested = false;
  clearLog();
  progressSection.classList.add('visible');
  btnSend.classList.add('sending');
  btnText.textContent = 'Detener envío';
  btnSend.querySelector('svg').innerHTML = '<rect x="6" y="6" width="12" height="12" rx="2" fill="white"/>';

  let sent = 0, errors = 0;

  for (let i = 0; i < phones.length; i++) {
    if (stopRequested) { logMsg('info', 'Envío detenido manualmente'); break; }

    const phone = phones[i];
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    progressCount.textContent = `${i + 1} / ${phones.length}`;
    progressFill.style.width = `${((i + 1) / phones.length) * 100}%`;
    currentPhone.textContent = `Abriendo chat: ${phone}`;

    try {
      // 1. Navegar al chat desde el popup (evita que el canal se cierre)
      const chatUrl = `https://web.whatsapp.com/send?phone=${cleanPhone}&type=phone_number&app_absent=0`;
      await navigateTab(tabId, chatUrl);

      // 2. Esperar que la página cargue completamente
      currentPhone.textContent = `Cargando chat: ${phone}`;
      await waitForTabLoad(tabId);
      await sleep(5000); // extra para que WhatsApp inicialice su UI

      // 3. Inyectar content script (la navegación lo borra)
      await injectContentScript(tabId);
      await sleep(800);

      // 4. Verificar que el script esté activo
      const alive = await pingContentScript(tabId);
      if (!alive) {
        logMsg('err', `${phone} — script no respondió`);
        errors++;
        saveToHistory({
          phone,
          messageBefore,
          messageAfter,
          hasImage: !!imageFile,
          success: false,
          error: 'Script no respondió',
          timestamp: new Date().toISOString()
        });
        continue;
      }

      // 5. Pedir al content script que envíe (ya está en la página correcta)
      const result = await sendMessage(tabId, { messageBefore, messageAfter, imageBase64, imageMimeType, imageFileName });
      if (result && result.success) {
        logMsg('ok', `${phone} — enviado`);
        sent++;
      } else {
        logMsg('err', `${phone} — ${result?.error || 'error desconocido'}`);
        errors++;
      }
      saveToHistory({
        phone,
        messageBefore,
        messageAfter,
        hasImage: !!imageFile,
        success: result && result.success,
        error: result?.error || null,
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      logMsg('err', `${phone} — ${err.message}`);
      errors++;
      saveToHistory({
        phone,
        messageBefore,
        messageAfter,
        hasImage: !!imageFile,
        success: false,
        error: err.message,
        timestamp: new Date().toISOString()
      });
    }

    if (i < phones.length - 1 && !stopRequested) {
      currentPhone.textContent = `Esperando ${delay / 1000}s...`;
      await sleep(delay);
    }
  }

  isSending = false;
  stopRequested = false;
  btnSend.classList.remove('sending');
  btnSend.querySelector('svg').innerHTML = '<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22,2 15,22 11,13 2,9"/>';
  btnText.textContent = 'Enviar a todos';
  currentPhone.textContent = `Completado: ${sent} enviados, ${errors} errores`;
  logMsg('info', `✅ Finalizado: ${sent} ok / ${errors} errores`);
});

// ─── Send message via content script ─────────────────────────
function sendMessage(tabId, payload) {
  return new Promise(resolve => {
    chrome.tabs.sendMessage(tabId, { action: 'doSend', ...payload }, res => {
      if (chrome.runtime.lastError) {
        resolve({ success: false, error: chrome.runtime.lastError.message });
      } else {
        resolve(res || { success: false, error: 'Sin respuesta' });
      }
    });
  });
}

// ─── Helpers ─────────────────────────────────────────────────
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ─── Persist state ────────────────────────────────────────────
chrome.storage.local.get(['savedPhones', 'savedMessageBefore', 'savedMessageAfter', 'savedDelay'], (data) => {
  if (data.savedPhones) { phonesEl.value = data.savedPhones; phonesEl.dispatchEvent(new Event('input')); }
  if (data.savedMessageBefore) messageBeforeEl.value = data.savedMessageBefore;
  if (data.savedMessageAfter) messageAfterEl.value = data.savedMessageAfter;
  if (data.savedDelay) delayInput.value = data.savedDelay;
});
phonesEl.addEventListener('change', () => chrome.storage.local.set({ savedPhones: phonesEl.value }));
messageBeforeEl.addEventListener('change', () => chrome.storage.local.set({ savedMessageBefore: messageBeforeEl.value }));
messageAfterEl.addEventListener('change', () => chrome.storage.local.set({ savedMessageAfter: messageAfterEl.value }));
delayInput.addEventListener('change', () => chrome.storage.local.set({ savedDelay: delayInput.value }));

// ─── Debug button ─────────────────────────────────────────────
document.getElementById('btnDebug').addEventListener('click', async () => {
  const tabs = await chrome.tabs.query({ url: 'https://web.whatsapp.com/*' });
  if (tabs.length === 0) { logMsg('err', 'Abrí WhatsApp Web primero'); return; }
  const tabId = tabs[0].id;
  await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
  await sleep(300);

  chrome.tabs.sendMessage(tabId, { action: 'debug' }, (res) => {
    if (chrome.runtime.lastError || !res) {
      logMsg('err', 'No se pudo conectar al script');
      return;
    }
    clearLog();
    logMsg('info', `Footer input: ${res.hasFooter ? '✓' : '✗'}`);
    logMsg('info', `Botón adjuntar: ${res.hasAttach ? '✓' : '✗'}`);
    logMsg('info', `Inputs file: ${res.fileInputs}`);
    logMsg('info', `#main: ${res.hasMain ? '✓' : '✗'}`);
    logMsg('info', `Attach selectors: ${res.attachSelector || 'ninguno'}`);
  });
});

// ─── Tabs ─────────────────────────────────────────────────────
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('tab' + tab.dataset.tab.charAt(0).toUpperCase() + tab.dataset.tab.slice(1)).classList.add('active');
    if (tab.dataset.tab === 'history') loadHistory();
  });
});

// ─── History functions ─────────────────────────────────────────
const HISTORY_KEY = 'messageHistory';

function getHistory() {
  return new Promise(resolve => {
    chrome.storage.local.get([HISTORY_KEY], data => {
      resolve(data[HISTORY_KEY] || []);
    });
  });
}

function saveToHistory(record) {
  getHistory().then(history => {
    history.unshift(record);
    const trimmed = history.slice(0, 500);
    chrome.storage.local.set({ [HISTORY_KEY]: trimmed });
  });
}

function formatDate(date) {
  return date.toLocaleString('es-AR', { 
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

async function loadHistory() {
  const history = await getHistory();
  const list = document.getElementById('historyList');
  const sent = history.filter(r => r.success).length;
  const errors = history.filter(r => !r.success).length;
  
  document.getElementById('statSent').textContent = sent;
  document.getElementById('statErrors').textContent = errors;
  document.getElementById('statTotal').textContent = history.length;

  if (history.length === 0) {
    list.innerHTML = '<p style="color:var(--muted);text-align:center;padding:20px;">No hay registros aún</p>';
    return;
  }

  list.innerHTML = history.map(r => `
    <div style="padding:8px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;">
      <div>
        <div style="color:${r.success ? 'var(--accent)' : '#ff6b6b'};font-weight:600;">
          ${r.success ? '✓' : '✗'} ${r.phone}
        </div>
        <div style="color:var(--muted);font-size:9px;">${r.messageBefore ? 'Antes: ' + r.messageBefore : ''}${r.messageAfter ? ' | Después: ' + r.messageAfter : ''}${(!r.messageBefore && !r.messageAfter) ? '(sin mensaje)' : ''}</div>
        <div style="color:var(--muted);font-size:9px;">${formatDate(new Date(r.timestamp))}</div>
      </div>
      <div style="font-size:10px;">${r.hasImage ? '🖼️' : ''}</div>
    </div>
  `).join('');
}

document.getElementById('btnExportCsv').addEventListener('click', async () => {
  const history = await getHistory();
  const headers = ['Fecha', 'Teléfono', 'Mensaje antes', 'Mensaje después', 'Imagen', 'Estado'];
  const rows = history.map(r => [
    formatDate(new Date(r.timestamp)),
    r.phone,
    `"${(r.messageBefore || '').replace(/"/g, '""')}"`,
    `"${(r.messageAfter || '').replace(/"/g, '""')}"`,
    r.hasImage ? 'Sí' : 'No',
    r.success ? 'Enviado' : 'Error'
  ]);
  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  // UTF-8 BOM for Excel compatibility
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `whatsapp_historial_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
});

document.getElementById('btnClearHistory').addEventListener('click', () => {
  if (confirm('¿Querés borrar todo el historial?')) {
    chrome.storage.local.set({ [HISTORY_KEY]: [] });
    loadHistory();
  }
});
