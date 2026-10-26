# Logo Tacómetro Vintage + Animaciones — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Estado:** ✅ completado e integrado en `main` (commit `1246026`).

**Goal:** Reemplazar el isotipo SVG por un logo de tacómetro vintage (PNG 2K) y añadir un sistema de animaciones pulidas en toda la PWA.

**Architecture:** El logo maestro 2K vive en `assets/brand/` y se derivan versiones optimizadas para header e iconos PWA con PIL. Las animaciones se implementan con CSS (keyframes + clases utilitarias) y pequeños helpers en `app.js` (transición direccional de vistas, contadores animados, disparo del “shake” al registrar). Todo respeta `prefers-reduced-motion`.

**Tech Stack:** HTML5, CSS3, JavaScript vanilla, PIL (generación de iconos), Service Worker, Chart.js.

**Spec:** Aprobado en conversación: tacómetro vintage de auto de los 80, colores armónicos con la paleta (`#FF6600`, `#0B0F19`, `#161F30`), PNG 2K, animaciones mezcladas en toda la app.

## Global Constraints

- No frameworks ni bundler: vanilla JS + CSS.
- Paleta existente: `--primary:#FF6600`, `--bg-main:#0B0F19`, `--bg-card:#161F30`.
- Todo debe funcionar offline (Service Worker).
- Accesibilidad: respetar `prefers-reduced-motion: reduce`.
- Sin errores de consola, sin HTTP ≥ 400, sin diálogos nativos.

## Review Focus

- El logo debe verse nítido en 44×44 px y no pesar 3 MB en la carga inicial.
- La animación de vistas no debe acumular clases ni romper el scroll.
- Los contadores no deben mostrar valores intermedios erróneos al re-renderizar.
- Los iconos PWA deben conservar el encuadre circular del tacómetro.
- Las animaciones no deben impedir clics ni interacción táctil.

---

### Task 1: Integrar logo tacómetro + iconos PWA

**Files:**
- Create: `assets/brand/logo-tacometro-2k.png`
- Create: `assets/icons/logo-tacometro.png`
- Modify: `assets/icons/favicon-16x16.png`, `favicon-32x32.png`, `apple-touch-icon.png`, `pwa-icon-192.png`, `pwa-icon-512.png`
- Modify: `index.html` (header + favicon)
- Modify: `css/styles.css` (`.brand-logo`)
- Modify: `js/app.js` (`BRAND_LOGO_SVG` → `<img>`)
- Modify: `sw.js` (caché v5 + assets)

**Interfaces:**
- Produces: `assets/icons/logo-tacometro.png` (256×256) para el header.

- [x] **Step 1:** Copiar el PNG 2K original a `assets/brand/logo-tacometro-2k.png` y generar con PIL las versiones 256, 192, 180, 32 y 16 px (LANCZOS).
- [x] **Step 2:** Sustituir el SVG inline del header por `<img src="assets/icons/logo-tacometro.png" alt="DIDI Tracker">` y ajustar `.brand-logo` a `overflow:hidden`.
- [x] **Step 3:** Actualizar `BRAND_LOGO_SVG` a un `<img>` y `renderLogoMarca()` para no sobrescribirlo.
- [x] **Step 4:** Subir `SW_CACHE` a `didi-tracker-v5` y añadir el nuevo logo a `LOCAL_ASSETS`.
- [x] **Step 5:** Verificar carga sin errores y commit.

### Task 2: Sistema de animaciones CSS

**Files:**
- Modify: `css/styles.css` (bloque final de animaciones)

- [x] **Step 1:** Añadir keyframes: `viewSlideLeft`, `viewSlideRight`, `modalPop`, `ctaPulse`, `trafficGlow`, `shakeGauge`, `toastInTop`.
- [x] **Step 2:** Aplicar transiciones a botones, tarjetas, semáforo, barra de progreso y `modal-content`.
- [x] **Step 3:** Añadir bloque `@media (prefers-reduced-motion: reduce)` que desactive animaciones.

### Task 3: Lógica de animación en JS

**Files:**
- Modify: `js/app.js`

- [x] **Step 1:** `inicializarNavegacion()`: calcular dirección por índice y añadir `view-slide-left|right` al panel visible.
- [x] **Step 2:** Helper `animarContadoresDashboard()` con rAF + easing, invocado al final de `renderDashboard()`.
- [x] **Step 3:** Configurar `Chart.defaults.animation` (700 ms, `easeOutQuart`).
- [x] **Step 4:** Añadir `dispararShakeTacometro()` en `guardarViajeDesdeFormulario()` tras registrar.

### Task 4: Verificación y sincronización

- [x] **Step 1:** Servir con `python3 -m http.server 8080` y auditar con `probar_pagina_web`.
- [x] **Step 2:** Captura de pantalla en móvil y escritorio.
- [x] **Step 3:** Commit y push con `sincronizar_proyecto`.
