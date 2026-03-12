// content.js v1.4 — Enfoque simplificado y robusto
if (!window.__waBulkSenderLoaded) {
  window.__waBulkSenderLoaded = true;
  console.log('[WA Bulk Sender] v1.4 loaded');
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'ping') { sendResponse({ alive: true }); return false; }

  if (msg.action === 'debug') {
    const attachSelectors = [
      '[data-testid="attach-btn"]',
      'button[aria-label*="Adjuntar"]',
      'button[aria-label*="Attach"]',
      'span[data-icon="plus"]',
      '[data-icon="plus"]',
    ];
    let attachSelector = null;
    for (const s of attachSelectors) {
      if (document.querySelector(s)) { attachSelector = s; break; }
    }
    sendResponse({
      hasFooter: !!document.querySelector('footer [contenteditable="true"]'),
      hasAttach: !!attachSelector,
      attachSelector,
      fileInputs: document.querySelectorAll('input[type="file"]').length,
      hasMain: !!document.querySelector('#main, main'),
    });
    return false;
  }
  if (msg.action === 'doSend') {
    doSend(msg).then(sendResponse).catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }
});

async function doSend({ messageBefore, messageAfter, imageBase64, imageMimeType, imageFileName }) {
  try {
    // 1. Esperar input del chat
    const inputBox = await waitForElement(
      'footer [contenteditable="true"], [data-tab="10"][contenteditable="true"]',
      10000
    );
    if (!inputBox) return { success: false, error: 'Chat no cargó' };
    await sleep(600);

    const hasBefore = messageBefore && messageBefore.trim();
    const hasAfter = messageAfter && messageAfter.trim();
    const hasImage = !!imageBase64;

    // Caso 1: Solo mensaje antes (sin imagen)
    if (hasBefore && !hasImage && !hasAfter) {
      inputBox.click();
      inputBox.focus();
      await sleep(300);
      document.execCommand('selectAll', false, null);
      document.execCommand('insertText', false, messageBefore);
      await sleep(300);
      await clickSend();
      await sleep(1200);
      return { success: true };
    }

    // Caso 2: Solo mensaje después (sin imagen) - tratado como mensaje normal
    if (hasAfter && !hasImage && !hasBefore) {
      inputBox.click();
      inputBox.focus();
      await sleep(300);
      document.execCommand('selectAll', false, null);
      document.execCommand('insertText', false, messageAfter);
      await sleep(300);
      await clickSend();
      await sleep(1200);
      return { success: true };
    }

    // Caso 3: Con imagen - enviar mensaje antes (si existe), luego imagen con caption
    if (hasImage) {
      // 3a. Enviar mensaje antes de la imagen si existe
      if (hasBefore) {
        inputBox.click();
        inputBox.focus();
        await sleep(300);
        document.execCommand('selectAll', false, null);
        document.execCommand('insertText', false, messageBefore);
        await sleep(300);
        await clickSend();
        await sleep(1500);
      }

      // 3b. Adjuntar imagen
      const bytes = Uint8Array.from(atob(imageBase64), c => c.charCodeAt(0));
      const file = new File([bytes], imageFileName || 'imagen.jpg', { type: imageMimeType || 'image/jpeg' });

      const attached = await tryAttachImage(file);
      if (!attached) return { success: false, error: 'No se pudo adjuntar la imagen' };

      // 3c. Esperar que el modal de envío aparezca
      await sleep(2000);

      // 3d. Caption después de la imagen
      if (hasAfter) {
        const captionBox = await waitForAnyElement([
          '[data-testid="media-caption-input-container"] [contenteditable="true"]',
          'div[contenteditable="true"][class*="caption"]',
          'div[contenteditable="true"][data-tab="10"]',
          'div[contenteditable="true"][aria-placeholder]',
          'span[contenteditable="true"]',
        ], 3000);

        if (captionBox) {
          captionBox.click();
          captionBox.focus();
          await sleep(300);
          document.execCommand('selectAll', false, null);
          document.execCommand('insertText', false, messageAfter);
          await sleep(400);
        }
      }

      // 3e. Enviar
      await sleep(500);
      const sent = await clickSend();
      if (!sent) {
        const active = document.activeElement;
        if (active) active.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true }));
      }
      await sleep(1200);
      return { success: true };
    }

    // Si llegó aquí sin imagen ni mensajes
    return { success: false, error: 'Sin imagen ni mensaje' };

  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ─── Intentar adjuntar con múltiples métodos ─────────────────
async function tryAttachImage(file) {
  // Método 1: Drag & drop sobre el área del chat
  if (await dropOnChat(file)) return true;
  await sleep(500);

  // Método 2: Pegar desde clipboard simulado
  if (await pasteImage(file)) return true;
  await sleep(500);

  // Método 3: Click en adjuntar + input file
  if (await clickAttachAndInject(file)) return true;

  return false;
}

// Método 1: Drop
async function dropOnChat(file) {
  try {
    const zone = document.querySelector('#main, main, [data-testid="conversation-panel-wrapper"]');
    if (!zone) return false;
    const dt = new DataTransfer();
    dt.items.add(file);
    const opts = { bubbles: true, cancelable: true, dataTransfer: dt };
    zone.dispatchEvent(new DragEvent('dragenter', opts));
    await sleep(100);
    zone.dispatchEvent(new DragEvent('dragover', opts));
    await sleep(100);
    zone.dispatchEvent(new DragEvent('drop', opts));
    await sleep(800);
    // Verificar si apareció algo (modal, overlay, canvas, img)
    const appeared = document.querySelector(
      '[data-testid="media-confirmation-window"], [data-testid="media-editor"], ' +
      'div[class*="popup-contents"], div[class*="_2Gdnd"], div[class*="media-panel"]'
    );
    return !!appeared;
  } catch { return false; }
}

// Método 2: Pegar imagen via ClipboardEvent
async function pasteImage(file) {
  try {
    const inputBox = document.querySelector('footer [contenteditable="true"]');
    if (!inputBox) return false;
    inputBox.focus();
    await sleep(200);

    const dt = new DataTransfer();
    dt.items.add(file);
    const pasteEvent = new ClipboardEvent('paste', {
      bubbles: true, cancelable: true, clipboardData: dt
    });
    inputBox.dispatchEvent(pasteEvent);
    await sleep(800);

    const appeared = document.querySelector(
      '[data-testid="media-confirmation-window"], [data-testid="media-editor"], ' +
      'div[class*="popup-contents"], div[class*="media-panel"]'
    );
    return !!appeared;
  } catch { return false; }
}

// Método 3: Click adjuntar + inject
async function clickAttachAndInject(file) {
  try {
    // Cerrar cualquier menú abierto primero
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }));
    await sleep(300);

    const attachBtn = await waitForAnyElement([
      '[data-testid="attach-btn"]',
      'button[aria-label*="Adjuntar"]',
      'button[aria-label*="Attach"]',
      'span[data-icon="plus"]',
      '[data-icon="plus"]',
      'li[data-testid="attach-btn"]',
    ], 4000);

    if (!attachBtn) return false;
    attachBtn.click();
    await sleep(800);

    // Buscar TODOS los inputs file visibles o no
    const allInputs = Array.from(document.querySelectorAll('input[type="file"]'));
    console.log('[WA Bulk] inputs encontrados:', allInputs.length, allInputs.map(i => i.accept));

    // Preferir el que acepta imágenes
    let target = allInputs.find(i => (i.accept || '').includes('image'));
    if (!target) target = allInputs.find(i => !(i.accept || '').includes('application')); // no docs
    if (!target && allInputs.length > 0) target = allInputs[0];
    if (!target) return false;

    // Inyectar con método nativo del prototipo
    const dt = new DataTransfer();
    dt.items.add(file);
    try {
      const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'files');
      descriptor.set.call(target, dt.files);
    } catch {
      Object.defineProperty(target, 'files', { value: dt.files, configurable: true, writable: true });
    }
    target.dispatchEvent(new Event('change', { bubbles: true }));
    target.dispatchEvent(new InputEvent('input', { bubbles: true }));
    await sleep(1500);
    return true; // asumimos éxito y dejamos que el flujo principal siga
  } catch (err) {
    console.error('[WA Bulk] clickAttachAndInject:', err.message);
    return false;
  }
}

async function clickSend() {
  // Buscar todos los botones de send posibles, incluyendo el del modal de imagen
  const selectors = [
    '[data-testid="send-button"]',
    'button[aria-label="Enviar"]',
    'button[aria-label="Send"]',
    'span[data-icon="send"]',
    '[data-icon="send"]',
  ];
  for (const sel of selectors) {
    // Tomar el último (el del modal tiene prioridad sobre el del input)
    const btns = document.querySelectorAll(sel);
    if (btns.length > 0) {
      btns[btns.length - 1].click();
      return true;
    }
  }
  return false;
}

// Espera el primero de varios selectores que aparezca
function waitForAnyElement(selectors, timeout = 5000) {
  return new Promise(resolve => {
    const combined = selectors.join(', ');
    const el = document.querySelector(combined);
    if (el) return resolve(el);
    const obs = new MutationObserver(() => {
      const found = document.querySelector(combined);
      if (found) { obs.disconnect(); resolve(found); }
    });
    obs.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => { obs.disconnect(); resolve(null); }, timeout);
  });
}

function waitForElement(selector, timeout = 5000) {
  return waitForAnyElement([selector], timeout);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
