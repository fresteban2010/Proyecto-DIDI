# Changelog — DIDI Pro

Historial de cambios de **DIDI Pro (PWA / DIDI Tracker)** y **DIDI Copiloto (Android)**.
Las fechas corresponden a los commits del repositorio.

---

## DIDI Copiloto (Android)

### 0.6.0 — 2026-10-31

- Captura de ofertas “Pon tu precio” **en segundo plano**: el recorte y guardado ya no frenan la siguiente lectura.
- Muestreo de pantalla cada **1,5 s** (antes 2 s) y reintento por eventos cada **0,8 s**.
- Menor espera entre capturas de la lista (**2 s**) y ventana de repetición de pantalla (**15 s**).
- **Respaldo de agrupación** cuando el OCR no alcanza a leer el botón `Aceptar`: se agrupa por precio y tramos.
- **Deduplicación por precio + ruta**: dos viajes distintos con el mismo precio ya no se mezclan ni se omiten.
- Detección tolerante a errores del OCR en `Centro de solicitudes` y `Pon tu precio` (truncados, `Preci0`, `Preclo`).
- Diagnóstico ampliado con `ocr_ms` y el tiempo de cada captura.
- 48 pruebas unitarias.

### 0.5.1 — 2026-10-31

- El botón **Registrar** de cada tarjeta “Pon tu precio” abre DIDI Pro con **precio, km y minutos precargados** (antes solo abría la pantalla principal).

### 0.5.0 — 2026-10-31

- **Recorte individual** de cada tarjeta: la miniatura ya no es la pantalla completa.
- Solo se guardan y muestran ofertas con **precio + los dos tramos completos**.
- Las tarjetas incompletas se descartan y aparecen cuando vuelven a capturarse completas.
- Deduplicación por precio y ventana de tiempo.

### 0.4.0 — 2026-10-31

- Ofertas “Pon tu precio” **individuales**: una tarjeta por oferta, sin mezclar dos servicios.
- Análisis por oferta: semáforo, COP/km, COP/h, frase explicativa, recogida y viaje.
- Pantalla **Ofertas Pon tu precio** con tarjeta de datos + miniatura y botones Ver / Registrar / Borrar.

### 0.3.0 — 2026-10-31

- Captura de la lista `Centro de solicitudes` con ofertas “Pon tu precio” que **no saltan**.
- Las listas no generan notificación; se guardan para revisarlas después.
- **Filtro antibucle**: el OCR ignora sus propias notificaciones (evitaba ofertas falsas y notificaciones en cadena).
- Pantalla de historial de capturas y máximo de 50.

### 0.2.1 — 2026-10-31

- Muestreo OCR **periódico** cada 2 s mientras DiDi está en primer plano.
- Reintento al terminar una captura y prioridad a eventos de ventana.
- Soluciona ofertas que aparecían entre eventos de accesibilidad.

### 0.2.0 — 2026-10-31

- **Notificación heads-up** por oferta con semáforo, COP/km, COP/h, motivo y botones Registrar / Ignorar.
- El overlay flotante queda como opción experimental desactivada por defecto.
- Parser robusto: distancias en metros, multiplicadores pegados (`$17.7941,5x`), `O` por `0` y botones de precio al final.
- Antiduplicado de 90 s.

### 0.1.x — 2026-10-26

- Primera versión del copiloto: servicio de accesibilidad, parser, motor de decisión, overlay, puente a la PWA y diagnóstico local.
- OCR on-device con ML Kit cuando DiDi no expone texto por accesibilidad.
- Soporte de recogida en **metros** en el parser.
- CI de Android y APK firmado para sideload con clave estable.

---

## DIDI Pro (PWA / DIDI Tracker)

### 2026-10-25 — Identidad, animaciones, PWA y rediseño móvil

- **Logo tacómetro vintage 80s** en PNG 2K, versiones optimizadas e iconos PWA.
- **Sistema de animaciones**: transiciones entre vistas, contadores, semáforo con glow, modales, toasts, shake al registrar y respeto a `prefers-reduced-motion`.
- **PWA instalable**: manifest en la raíz, rutas relativas, iconos `any` + `maskable`, capturas, atajos, banner/tarjeta de instalación y metadatos iOS.
- **GitHub Pages** con HTTPS, `.nojekyll`, Service Worker v10 y botón de instalación Android/iOS.
- **Rediseño móvil**: cabecera no fija, acción **+ Registrar** integrada en la barra inferior de 5 ítems y controles Audio/Reiniciar también en Ajustes.
- **Registro desde el copiloto**: `?registrar=1` abre el modal detallado con los datos precargados y limpia la URL.

### Fases 1–5 — Base del tracker

- Service Worker offline, toasts, modal de confirmación y navegación inferior.
- IndexedDB local-first, migración desde localStorage y respaldo JSON.
- Modo rápido, audio sintético y calculadora pre-viaje.
- Cierre de turno inmutable, costos ocultos y ganancia neta real.
- Reportes día/semana/mes y rendimiento por franjas horarias.
