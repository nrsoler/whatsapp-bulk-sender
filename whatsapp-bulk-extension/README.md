# 📲 WhatsApp Bulk Sender — Extensión de Chrome

Envía mensajes con imagen a múltiples contactos de WhatsApp Web de forma automática.

---

## 🚀 Instalación (5 pasos)

### 1. Descomprimí el ZIP
Extraé la carpeta `whatsapp-bulk-extension` en tu computadora.

### 2. Abrí Chrome y andá a las extensiones
Escribí en la barra de dirección:
```
chrome://extensions
```

### 3. Activá el Modo Desarrollador
En la esquina superior derecha, activá el toggle **"Modo de desarrollador"**.

### 4. Cargá la extensión
Hacé clic en **"Cargar descomprimida"** y seleccioná la carpeta `whatsapp-bulk-extension`.

### 5. ¡Listo!
Vas a ver el ícono verde en tu barra de herramientas de Chrome.

---

## 📖 Cómo usarla

1. **Abrí WhatsApp Web** en `web.whatsapp.com` e iniciá sesión
2. **Hacé clic en el ícono** de la extensión
3. **Ingresá los números** de teléfono:
   - Escribilos manualmente separados por `,` `;` o salto de línea
   - Pegá desde portapapeles
   - Importá un archivo CSV o Excel (debe contener los números en alguna columna)
4. **Subí la imagen** que querés enviar
5. **Escribí el mensaje** (opcional, puede ir solo la imagen)
6. **Configurá la espera** entre mensajes (mínimo 2 segundos recomendado)
7. **Hacé clic en "Enviar a todos"**

La extensión va a abrir cada chat automáticamente y enviar la imagen + mensaje.

---

## ⚠️ Formato de números

Los números deben incluir el **código de país**:

| País | Ejemplo |
|------|---------|
| Argentina | +5491112345678 |
| México | +5215512345678 |
| España | +34612345678 |
| Colombia | +5731512345678 |

---

## 📁 Importar desde Excel/CSV

El archivo puede tener los números en cualquier columna. La extensión va a detectar automáticamente todos los números válidos en el archivo.

**Formatos soportados:** `.csv`, `.xlsx`, `.xls`, `.txt`

---

## ⚡ Consejos

- Usá una espera de al menos **4 segundos** entre mensajes para evitar bloqueos
- WhatsApp puede detectar envíos masivos si son muy rápidos
- No cerrés ni minimices WhatsApp Web mientras se envían los mensajes
- Podés **detener el envío** en cualquier momento haciendo clic en "Detener envío"

---

## 🔒 Privacidad

Esta extensión funciona **100% localmente** en tu navegador. No envía ningún dato a servidores externos. Solo interactúa con WhatsApp Web desde tu sesión activa.

---

## 🐛 Solución de problemas

| Problema | Solución |
|----------|----------|
| "Abrí WhatsApp Web primero" | Abrí `web.whatsapp.com` e iniciá sesión |
| La imagen no se adjunta | Esperá a que WhatsApp Web cargue completamente |
| Mensajes no enviados | Aumentá el tiempo de espera |
| Número inválido | Verificá que incluya el código de país |
