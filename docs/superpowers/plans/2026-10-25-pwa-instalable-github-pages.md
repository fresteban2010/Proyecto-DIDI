# PWA Instalable + Publicación en GitHub Pages — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que DIDI Pro se pueda instalar como app real desde Chrome (Android) y Safari (iPhone) y funcione al 100 % offline, publicada con HTTPS en GitHub Pages.

**Architecture:** Manifest en la raíz del sitio con rutas relativas (compatible con el subdirectorio `/proyecto-didi/` de Pages), iconos maskable para Android, capturas para el diálogo enriquecido de instalación, y una capa de UI en `app.js` que captura `beforeinstallprompt`, muestra botón/banner de instalación y ofrece instrucciones específicas para iOS. El Service Worker sube a caché v6 y precachea el nuevo manifest.

**Tech Stack:** HTML5, CSS3, JavaScript vanilla, PIL (iconos), Service Worker, GitHub Pages (HTTPS), Playwright (verificación).

**Spec:** Conversación aprobada: publicación en GitHub Pages + instalación PWA al 100 % en celular (Android e iPhone).

## Global Constraints

- Rutas **relativas** en todo el proyecto: el sitio vive en `https://fresteban2010.github.io/proyecto-didi/`, no en la raíz del dominio.
- HTTPS obligatorio para instalar; GitHub Pages lo provee.
- Sin frameworks ni bundler.
- Accesibilidad: respetar `prefers-reduced-motion` y `aria-*` en la UI nueva.
- Datos del usuario permanecen en el dispositivo (IndexedDB); la app publicada no envía información.
- **Decisión pendiente del dueño:** el repo es privado y el plan gratuito no publica Pages desde repos privados. Hacerlo público requiere su aprobación explícita (no hay secretos en el código; se verifica antes).

## Review Focus

- La instalación debe ofrecer icono correcto en Android (maskable, sin recortes) y en iPhone (apple-touch-icon).
- El botón de instalación no debe aparecer si la app ya corre en modo standalone.
- Las rutas deben resolver bajo `/proyecto-didi/`, no bajo la raíz del dominio.
- El modo offline debe servir `index.html` y los assets tras la primera visita.
- Los atajos del manifest deben abrir la vista correcta sin romper el estado.

---

### Task 1: Manifest en raíz + iconos maskable + capturas + atajos

**Files:**
- Create: `manifest.json` (raíz del proyecto)
- Create: `assets/icons/pwa-icon-192-maskable.png`, `assets/icons/pwa-icon-512-maskable.png`
- Create: `assets/screenshots/mobile.png` (390×844), `assets/screenshots/desktop.png` (1280×800)
- Delete: `assets/icons/manifest.json` (tras actualizar referencias)
- Modify: `index.html:8`, `sw.js` (LOCAL_ASSETS)

**Interfaces:**
- Produces: manifest raíz con `"start_url": "./index.html"`, `"scope": "./"`, `"id": "./"`, iconos `any` + `maskable`, `screenshots`, `shortcuts` (`?view=turno|calculadora|historial`).

- [ ] **Step 1:** Generar iconos maskable con PIL: logo escalado al 78 % centrado sobre fondo `#0B0F19` (zona segura Android), 192 y 512 px.
- [ ] **Step 2:** Capturar pantallas reales de la app con browser-qa en 390×844 y 1280×800 y guardarlas en `assets/screenshots/`.
- [ ] **Step 3:** Crear `manifest.json` en la raíz con `name`, `short_name`, `description`, `id`, `start_url`, `scope`, `display: standalone`, `display_override`, `orientation: portrait`, `background_color`, `theme_color`, `lang`, `categories`, los 4 iconos (`any` y `maskable`), `screenshots` (narrow/wide) y `shortcuts`.
- [ ] **Step 4:** Actualizar `index.html` al nuevo `href="manifest.json"` y borrar el manifest antiguo.
- [ ] **Step 5:** Actualizar `sw.js`: `SW_CACHE` a `didi-tracker-v6`, ruta del manifest y nuevos iconos en `LOCAL_ASSETS`.
- [ ] **Step 6:** Añadir soporte `?view=` en `app.js` al final de `DOMContentLoaded` (clic programático en `.nav-item[data-view="..."]` si el parámetro es válido).
- [ ] **Step 7:** Verificar que `manifest.json` responde 200 y que todas las rutas de iconos/capturas resuelven.

### Task 2: Metadatos iOS + UI de instalación

**Files:**
- Modify: `index.html` (metas, sección en Ajustes, banner, modal de instrucciones)
- Modify: `css/styles.css` (banner, tarjeta de instalación, pasos)
- Modify: `js/app.js` (gestor de instalación)

**Interfaces:**
- Produces: `configurarInstalacionPWA()` invocada en `DOMContentLoaded`; IDs `#btn-instalar-app`, `#install-banner`, `#modal-instalar`, `#install-estado`.

- [ ] **Step 1:** Añadir meta tags: `mobile-web-app-capable`, `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style`, `apple-mobile-web-app-title` y `description`.
- [ ] **Step 2:** Crear en Ajustes la tarjeta "Instalar aplicación" con botón `#btn-instalar-app` y texto de estado `#install-estado` (oculta si ya está instalada).
- [ ] **Step 3:** Crear banner superior discreto `#install-banner` con botón Instalar y botón cerrar; persistir el cierre en `localStorage` (`didi_install_banner_dismissed`).
- [ ] **Step 4:** Crear modal `#modal-instalar` con pasos distintos para Android (Chrome: menú ⋮ → Instalar aplicación) e iOS (Safari: Compartir → Añadir a pantalla de inicio).
- [ ] **Step 5:** En `js/app.js`, implementar `configurarInstalacionPWA()`: capturar `beforeinstallprompt` (guardar evento, mostrar UI), manejar `appinstalled` (ocultar UI + toast), detectar `display-mode: standalone`, detectar iOS y abrir el modal de instrucciones cuando no exista prompt nativo.
- [ ] **Step 6:** Añadir estilos para banner, tarjeta y modal respetando `prefers-reduced-motion`.
- [ ] **Step 7:** Verificar en runtime que el botón aparece/oculta según el estado y que el modal abre/cierra sin errores.

### Task 3: Service Worker offline v6 y verificación de caché

**Files:**
- Modify: `sw.js`

- [ ] **Step 1:** Confirmar precache completo: `index.html`, CSS, JS, manifest raíz, iconos any/maskable, `apple-touch-icon`.
- [ ] **Step 2:** Verificar en navegador que el SW pasa a `activated`, que `caches.keys()` incluye `didi-tracker-v6` y que los assets esenciales están en caché.
- [ ] **Step 3:** Comprobar que una navegación con el SW controlando devuelve `index.html` desde caché (fallback offline).

### Task 4: Publicación en GitHub Pages

**Files:**
- Create: `.nojekyll`
- Repo: cambiar visibilidad a pública (aprobación del dueño) o usar plan Pro.
- Repo: habilitar Pages desde rama `main`, carpeta `/` (raíz).

- [ ] **Step 1:** Escanear el repo en busca de secretos (`token`, `secret`, `password`, `api_key`) y confirmar que no hay credenciales.
- [ ] **Step 2:** Crear `.nojekyll` y hacer commit/push.
- [ ] **Step 3:** Con aprobación, cambiar el repo a público vía API de GitHub.
- [ ] **Step 4:** Habilitar Pages (`PUT /repos/Fresteban2010/proyecto-didi/pages`, `source: {branch: "main", path: "/"}`).
- [ ] **Step 5:** Esperar el build y verificar `https://fresteban2010.github.io/proyecto-didi/` con HTTP 200 y assets 200.
- [ ] **Step 6:** Verificar que `manifest.json`, iconos y `sw.js` cargan bajo el subdirectorio.

### Task 5: Verificación móvil e instalación real

- [ ] **Step 1:** Auditoría Playwright sobre la URL publicada (móvil y escritorio): 0 excepciones, 0 errores de consola, 0 HTTP ≥400, 0 diálogos.
- [ ] **Step 2:** Validar criterios de instalabilidad: manifest válido, icono 192/512, `start_url` en scope, SW con handler `fetch`.
- [ ] **Step 3:** Documentar pasos de instalación en el README (Android e iOS) y probar en el teléfono real.
- [ ] **Step 4:** Verificar en el teléfono: icono en pantalla de inicio, apertura en modo standalone, recarga sin conexión y persistencia de datos.
- [ ] **Step 5:** Commit final y push.
