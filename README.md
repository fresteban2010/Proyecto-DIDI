# DIDI Pro — Monitor de Ganancias y Rentabilidad

Aplicación web progresiva (**PWA**) para conductores de plataformas de transporte en Colombia (COP). Funciona **100 % del lado del cliente**: sin servidores, sin cuentas y sin base de datos remota. Los datos viven en el dispositivo (IndexedDB) y la app opera **offline**.

Su objetivo es auditar la rentabilidad real de cada carrera y de cada jornada mediante un semáforo (COP/hora y COP/km), descontar combustible y mantenimiento para conocer la **ganancia neta real**, cerrar turnos con métricas congeladas y analizar el rendimiento por día, semana, mes y franja horaria.

---

## Estado del proyecto

Las cinco fases del plan de mejoras están implementadas:

| Fase | Contenido | Estado |
| :--- | :--- | :---: |
| 1 | Estabilización, fixes de markup, CTA y **Service Worker offline** | ✅ |
| 2 | **Toasts**, modal de confirmación y **Bottom Nav** one-thumb | ✅ |
| 3 | **IndexedDB local-first**, migración y **respaldo JSON tipo Drive** | ✅ |
| 4 | **Modo Rápido**, **audio sintético** y **calculadora pre-viaje** | ✅ |
| 5 | **Cierre de turno**, **costos ocultos** y **analítica multi-jornada** | ✅ |

---

## Funcionalidades

### 1. Turno Activo (Dashboard)

- **Auditoría del último viaje:** desglose de tiempos y distancias, COP/hora y COP/km, semáforo 🟢🟡🔴 y comparativa contra la meta o el promedio de la sesión.
- **Resumen de jornada y meta diaria:** acumulados, promedios, slider de meta ($30.000–$400.000), barra de progreso y proyección de tiempo restante al ritmo actual.
- **Gráficos interactivos (Chart.js):**
  - Dona de ingresos **Efectivo vs Tarjeta**.
  - Barras de **COP/h por carrera** con línea de meta y color de semáforo.
- **Combustible y bolsillo real:**
  - Kilómetros rodados y desgaste estimado (por defecto `$16.000/gal ÷ 40 km/gal = $400/km`).
  - Registro de **tanqueadas** (monto, galones autocalculados, nota/odómetro).
- **Costos ocultos (mantenimiento):**
  - **Lavado** (monto manual + nota).
  - **Cambio de aceite** (monto sugerido configurable, odómetro, intervalo de referencia).
  - Tarjeta de **Mantenimiento** y **Ganancia Neta Real** = Bruto − Gasolina − Mantenimiento.
- **Historial de la sesión:** tabla con edición/eliminación y exportación CSV.
- **Finalizar Turno:** cierre con confirmación; congela métricas y deja la jornada inmutable en el historial.

### 2. Registro de carreras

- **Modo Rápido** (predeterminado): solo 3 campos → **Distancia total (km)**, **Tiempo total (min)** y **Valor DiDi (COP)**. Pensado para registrar en menos de 5 segundos con una mano.
- **Desglose Detallado:** distancia/tiempo de recogida y entrega por separado.
- Al alternar de modo se conservan los valores ya escritos; al **editar** una carrera se abre siempre en detallado.
- Método de pago: **Efectivo** o **Tarjeta**.

### 3. Calculadora pre-viaje

- Evaluación instantánea de una propuesta **antes de aceptarla**: COP/h, COP/km, semáforo y veredicto frente a las metas.
- **Teclado numérico en pantalla** (además del teclado nativo móvil).
- Botón **Aceptar y Registrar**: crea la carrera en el turno activo, guarda, emite el tono del semáforo y muestra un toast. Se registra como **Efectivo** (editable luego en el historial).

### 4. Feedback de audio sintético (Web Audio API)

Sin archivos MP3: osciladores senoidales con envolvente anti-clic.

| Semáforo | Tono | Duración |
| :--- | :--- | :--- |
| 🟢 Excelente | Dual agudo ascendente `880 → 1200 Hz` | 120 ms |
| 🟡 Aceptable | Neutro estable `660 Hz` | 150 ms |
| 🔴 No rentable | Grave descendente `330 → 220 Hz` | 200 ms |

- El `AudioContext` se desbloquea con el **primer gesto real** del usuario.
- Interruptor **Audio** en la cabecera (silenciar/activar), persistido en la configuración.

### 5. Historial y reportes

- **Historial de la sesión:** tabla de carreras con edición/eliminación y CSV.
- **Jornadas registradas:** tarjetas de jornadas **activas** y **cerradas**; las cerradas muestran su **resumen congelado** (bruto, gasolina, mantenimiento, neto real, COP/h).
- **Reportes Día / Semana / Mes:** bruto, neto real, rentabilidad media y carreras, con **comparativa % vs el período anterior** equivalente (hoy, últimos 7 días o últimos 30 días).
- **Rendimiento por franja horaria** (Chart.js): COP/h promedio por bloque `06–09`, `09–12`, `12–15`, `15–18`, `18–22`, `22–06`, con línea de meta y resaltado de la mejor franja.

### 6. Ajustes y respaldo

- **Respaldo JSON** compatible con Google Drive:
  - En móvil usa **Web Share API** (menú de compartir → Drive).
  - En PC con Chromium usa **File System Access API** (elegir carpeta).
  - Fallback universal: descarga `didi_backup_YYYY-MM-DD.json`.
- **Restauración** con validación de integridad del respaldo (secciones y versión de esquema).
- **Estadísticas de almacenamiento:** jornadas, viajes, tanqueadas y gastos.
- **Costos configurables:** costo sugerido del aceite (por defecto `$200.000`) e intervalo de aceite (por defecto `5.000 km`).

### 7. PWA y modo offline

- **URL publicada:** https://fresteban2010.github.io/Proyecto-DIDI/
- Instalable en Android/iOS/escritorio (`manifest.json`, iconos 192/512 `any` + `maskable`, capturas, atajos y `display: standalone`).
- **Instalar en Android (Chrome):** abrir la URL → menú **⋮** → **Instalar aplicación** (o usar el banner/botón *Instalar* dentro de la app).
- **Instalar en iPhone (Safari):** abrir la URL → botón **Compartir** → **Añadir a pantalla de inicio** → **Añadir**. En iOS no existe el instalador automático; la app muestra las instrucciones desde el botón *Instalar DIDI Pro* en Ajustes.
- La app detecta si ya está instalada (`display-mode: standalone`) y oculta el aviso de instalación.
- **Service Worker** (`sw.js`, caché `didi-tracker-v6`):
  - Navegación: *Network-First* con fallback a caché.
  - Assets locales (`index.html`, CSS, JS, iconos): *Stale-While-Revalidate*.
  - CDNs (Chart.js, Lucide, Google Fonts): *Cache-First*.
- Recarga automática al activarse una nueva versión del Service Worker (evita mezclar assets viejos con lógica nueva).

---

## Cálculos y reglas de negocio

- `D_total = distRecogidaKm + distEntregaKm`
- `T_total = tiempoRecogidaMin + tiempoEntregaMin`
- `COP/h = precioCOP ÷ (T_total ÷ 60)`
- `COP/km = precioCOP ÷ D_total`
- `Gasto gasolina = D_total × (precioGalonCOP ÷ rendimientoGalonKm)`
- `Ganancia neta (bruta) = Bruto − Gasolina`
- `Ganancia neta real = Bruto − Gasolina − Mantenimiento (lavados + aceite)`

**Semáforo de rentabilidad**

| Estado | Condición |
| :--- | :--- |
| 🟢 Excelente | Cumple **ambas** metas (≥ `$30.000/h` y ≥ `$2.000/km` por defecto) |
| 🟡 Aceptable | Cumple al menos una meta o alcanza el **80 %** de ambas |
| 🔴 No rentable | No alcanza los umbrales |

**Jornadas**

- Una jornada cerrada es **inmutable**: no permite editar, eliminar ni registrar datos.
- Para registrar de nuevo se ofrece **iniciar una nueva jornada** (la cerrada se conserva).
- Solo se puede cerrar un turno con **al menos una carrera**.
- Los reportes filtran por la **fecha/hora de cada viaje o gasto**, no por la fecha de la jornada.

---

## Modelo de datos y persistencia

**IndexedDB** es la fuente de la verdad (`DidiTrackerDB`, v1):

| Almacén | Clave | Contenido |
| :--- | :--- | :--- |
| `jornadas` | `id` | `fechaInicio`, `fechaFin`, `estado` (`activa`/`cerrada`), `resumen` congelado |
| `viajes` | `id` (+ índice `jornadaId`) | tiempos, distancias, precio, método, COP/h, COP/km, semáforo |
| `tanqueadas` | `id` (+ índice `jornadaId`) | monto, galones, nota |
| `gastosPuntuales` | `id` (+ índice `jornadaId`) | `tipo` (`lavado`/`aceite`), monto, odómetro, nota |
| `config` | `clave` | metas, combustible, audio, costos de aceite |

- **Migración transparente e idempotente:** si existe la clave antigua `didi_tracker_data` en `localStorage` y la base está vacía, se importa automáticamente.
- `localStorage` se conserva como **espejo/fallback** (y para migración), pero IndexedDB manda.
- **Respaldo JSON:** incluye los 5 almacenes + metadatos (`app`, `schema`, `exportadoEn`). La restauración reemplaza los datos actuales en una transacción.

---

## Exportación CSV

- Archivo `didi_jornada_YYYY-MM-DD.csv`.
- Codificación **UTF-8 con BOM** y delimitador `;` (óptimo para Excel en español).
- Incluye una fila de resumen de la sesión (bruto, efectivo/tarjeta, promedios, meta, gasolina y ganancia neta antes de mantenimiento).
- El mantenimiento (lavados/aceite) queda registrado en el respaldo JSON y en la analítica; no se añadió al CSV.

---

## Estructura de archivos

```
Proyecto DIDI/
├── index.html                  # SPA: 4 vistas, modales y PWA
├── css/
│   └── styles.css              # Tema oscuro, responsive y estados de semáforo
├── js/
│   ├── db.js                   # Capa IndexedDB (DidiTrackerDB v1)
│   └── app.js                  # Estado, cálculos, render, audio, reportes y CRUD
├── manifest.json               # Manifest PWA (raíz, rutas relativas)
├── sw.js                       # Service Worker (offline, caché v6)
├── assets/
│   ├── brand/
│   │   └── logo-tacometro-2k.png
│   ├── screenshots/
│   │   ├── mobile.png
│   │   └── desktop.png
│   └── icons/
│       ├── logo-tacometro.png
│       ├── favicon.svg
│       ├── favicon-16x16.png
│       ├── favicon-32x32.png
│       ├── apple-touch-icon.png
│       ├── pwa-icon-192.png
│       ├── pwa-icon-512.png
│       ├── pwa-icon-192-maskable.png
│       └── pwa-icon-512-maskable.png
├── plan de ejecucion arreglos.txt   # Plan de las 5 fases
├── PLAN_EXECUCION_GIT.md
└── README.md
```

---

## Cómo ejecutarlo

No requiere instalación, compilación ni base de datos.

### Opción 1 — Abrir directamente

Haz doble clic en `index.html`. La app funciona, pero los **Service Workers no se registran en `file://`** (restricción del navegador), así que el modo offline/PWA no estará disponible.

### Opción 2 — Servidor local (recomendado)

```bash
# Python 3
python3 -m http.server 8080

# o Node.js
npx serve .
```

Abre `http://localhost:8080`.

### Opción 3 — Instalar como PWA

1. Publica la carpeta en un hosting estático (GitHub Pages, Vercel, Netlify, Cloudflare Pages).
2. Abre la URL en el móvil (Chrome Android / Safari iOS).
3. Menú del navegador → **«Agregar a la pantalla de inicio»** / **«Instalar aplicación»**.

> La restauración de respaldos reemplaza los datos actuales: exporta antes de importar otra copia.

---

## Tecnologías y APIs

- **HTML5 semántico** y CSS3 (Grid/Flexbox, variables, dark mode, `env(safe-area-inset-*)`).
- **JavaScript Vanilla (ES6+)**, sin frameworks ni bundler.
- **Chart.js 4.4.1** (dona, barras + línea de meta, franjas horarias).
- **Lucide Icons** y **Google Fonts (Inter)** vía CDN.
- **APIs del navegador:** IndexedDB, localStorage, Service Worker + Cache API, Web Audio API, Web Share API, File System Access API, Blob/`URL.createObjectURL`, `Intl.NumberFormat` (`es-CO`).

---

## Arquitectura y notas técnicas

- **Separación de responsabilidades:** funciones puras de cálculo (`calcularMetricasViaje`, `calcularResumenSesion`) y capa de render que solo transfiere datos al DOM.
- **Estado:** `appData` con `config` y `sesionActual` (`id`, fechas, estado, `resumen`, viajes, tanqueadas, gastos). Cada mutación llama a `guardarDatos()`, que espeja en `localStorage` y persiste en IndexedDB.
- **Gráficos:** instancias reutilizadas (`chartPagosInstance`, `chartCarrerasInstance`, `chartFranjasInstance`); se actualizan con `.update()` para evitar parpadeos y fugas.
- **Inmutabilidad:** al cerrar una jornada se guarda un `resumen` congelado y se bloquean las mutaciones de esa jornada.
- **Tolerancia a fallos:** el render verifica la disponibilidad de Chart.js/Lucide y la app cae a `localStorage` si IndexedDB no está disponible.
- **Sin red obligatoria:** si fallan los CDNs, las funciones esenciales de cálculo y registro siguen operativas.
- **Privacidad:** todo se guarda en el dispositivo; no se envía información a servidores.

---

## Privacidad

Los datos de ganancias, viajes y gastos **nunca salen del dispositivo** salvo cuando tú exportas un respaldo y decides dónde guardarlo (Drive, archivos, etc.). No hay analítica, cuentas ni telemetría.

---

## Compatibilidad y limitaciones

- Navegadores modernos: Chrome/Edge/Brave, Safari, Firefox.
- **PWA/offline:** requiere `http://` o `https://` (no `file://`).
- **Web Share API:** disponible principalmente en móviles; si no existe, se usa la descarga.
- **File System Access API:** disponible en Chromium de escritorio; si no, se usa la descarga.
- La sincronización con Google Drive es **manual** (compartir/guardar el JSON), no hay OAuth ni sincronización automática.
- El CSV de la jornada no incluye los gastos de mantenimiento (sí el respaldo JSON y los reportes).

---

## Verificación

La aplicación fue validada con pruebas automatizadas de navegador (Playwright headless) sobre un servidor local:

- Carga limpia: **0 excepciones, 0 errores de consola, 0 respuestas HTTP ≥ 400 y 0 diálogos nativos**.
- Persistencia real en IndexedDB entre recargas y sesiones, incluida la migración desde `localStorage`.
- Flujos E2E: registro rápido, calculadora → carrera, lavado/aceite, cierre de turno, nueva jornada, reportes y franjas horarias.
- Layout verificado en móvil (390×664) y escritorio (1440×900) sin desbordes horizontales.
