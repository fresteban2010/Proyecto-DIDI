# Asistente de ofertas DiDi en tiempo real — Diseño y plan (propuesta para revisión)

**Fecha:** 2026-10-26
**Estado:** 🟡 Propuesta — pendiente de aprobación. No se ha escrito código.
**Proyecto:** DIDI Pro (`/home/fresteban/Escritorio/Proyecto DIDI`)

---

## 1. Qué se quiere

Cuando llegue una oferta de DiDi Conductor, DIDI Pro debe decir **en segundos** si la carrera conviene o no:

- Semáforo 🟢 / 🟡 / 🔴.
- COP/h y COP/km reales, **incluyendo la recogida**.
- Una frase corta que explique **por qué** conviene o no ("la recogida de 4,2 km te deja en $890/km", "vas a $41.000/h, por encima de tu meta").
- Que la decisión siga siendo del conductor: la app **aconseja**, no acepta ni rechaza.

---

## 2. Hallazgo principal (investigación)

**Una PWA no puede hacer esto sola.** El navegador no tiene acceso a:

- Notificaciones de otras apps.
- Contenido de la pantalla de otra app.
- Ventanas flotantes sobre otras apps.

Por tanto hace falta una **capa Android nativa** (Kotlin). La PWA sigue siendo el panel de datos y reportes; el asistente de ofertas vive en una app Android que se comunica con ella.

### Prior art (ya existe y funciona)

| Producto | Qué hace | Cómo lo hace (según su web) |
| :--- | :--- | :--- |
| **Ruta Rentable** (`com.wsb.dalehelperdriver`, Play Store) | Analiza valor, distancia al pasajero y tiempo estimado; semáforo; Android 8+ | Monitoreo automático en segundo plano |
| **CollaboCORE / UberAnálisis** | Lee tarifa y distancias **de la pantalla**, overlay "CONVIENE / NO CONVIENE" | Android + Kotlin + overlay en tiempo real |
| **RutaPro** (México/Colombia) | Copiloto de rentabilidad Uber/DiDi | App nativa en segundo plano |
| **RideSmart** | Analiza solicitudes de DiDi, Uber e InDrive | App nativa |

Esto confirma que es viable, y también que el patrón técnico es **app nativa + lectura de pantalla/notificación + overlay**.

### 2.1 Oferta real observada (captura del 2026-10-26)

La pantalla de oferta de DiDi Conductor muestra todos los datos necesarios en texto:

| Campo | Valor observado |
| :--- | :--- |
| Método de pago | `Efectivo` |
| Valor total | **$16.206** |
| Desglose | $1.600 adicionales · $608 tarifa base dinámica · $1.400 tarifa de gasolina |
| Pasajero | 4,84 ★ · 136 arrendamientos |
| Recogida | **8 min (1,9 km)** — Calle 68a #86a-17, Engativá |
| Viaje | **35 min (11,2 km)** — Conjunto Residencial Boreal Portería Américas, Kennedy |
| Acción | Botón `Aceptar` |

**Cálculo con las metas por defecto del proyecto** ($30.000/h y $2.000/km, gasolina $400/km):

| Interpretación | km totales | min totales | COP/km | COP/h | Semáforo |
| :--- | ---: | ---: | ---: | ---: | :---: |
| Recogida + viaje (43 min) | 13,1 | 43 | **$1.237** | **$22.613** | 🔴 |
| El viaje ya incluye la recogida (35 min) | 13,1 | 35 | **$1.237** | **$27.782** | 🔴 |

- Costo estimado de gasolina: `13,1 km × $400/km = $5.240`.
- Ganancia neta estimada: **$10.966** (43 min) o el mismo neto con la hora en $18.803 (35 min).
- **La “tarifa de gasolina” de $1.400 es un recargo que paga DiDi, no el costo real del vehículo**; no se debe restar dos veces. El motor usa el precio total como bruto y calcula el combustible por km.
- Con las metas actuales, la oferta es 🔴 por ambos criterios. La frase sería:
  > **“No conviene: 13,1 km y 43 min para $16.206. Quedas en $1.237/km y $22.613/h.”**

**Consecuencia para el diseño:** el texto está en la pantalla, así que la fuente primaria es **lectura de accesibilidad** (con OCR como respaldo). La notificación por sí sola probablemente no trae el desglose; se usará solo como disparador. Queda por confirmar en la fase 0 si los 35 min ya incluyen los 8 de recogida: es el único dato ambiguo y cambia el COP/h.

### APIs relevantes

- **AccessibilityService** — lee el árbol de accesibilidad de la ventana de DiDi (textos, botones). Permite además dibujar un overlay con `TYPE_ACCESSIBILITY_OVERLAY` sin pedir el permiso extra de "Dibujar sobre otras apps". Requiere declaración especial en Play Store desde Android 12.
- **NotificationListenerService** — recibe las notificaciones publicadas por DiDi (`EXTRA_TITLE`, `EXTRA_TEXT`, `EXTRA_BIG_TEXT`). Mucho más simple y estable, **pero solo sirve si la notificación trae precio y distancias**. Si DiDi solo notifica "Nuevo viaje", no alcanza.
- **MediaProjection + ML Kit OCR** — captura la pantalla y hace OCR on-device. Funciona aunque la app use renderizado propio (Flutter/canvas), pero añade 1–2 s de latencia, consume batería y en Android 14+ exige consentimiento por sesión. Buen **fallback**.
- **Overlay** — `SYSTEM_ALERT_WINDOW` + `TYPE_APPLICATION_OVERLAY`, o `TYPE_ACCESSIBILITY_OVERLAY` si ya hay servicio de accesibilidad.

### Restricciones que condicionan el diseño

1. **La oferta dura pocos segundos.** El pipeline completo (evento → parseo → cálculo → overlay) debe tardar **< 500 ms**.
2. **El formato de la oferta no está documentado y cambia con las versiones de DiDi.** Hay que capturarlo de un dispositivo real antes de escribir el parser (fase 0).
3. **Fabricantes agresivos** (Xiaomi, Huawei, Samsung) matan servicios en segundo plano; hay que guiar al usuario para excluir la app de la optimización de batería.
4. **Play Store**: usar `AccessibilityService` exige el formulario de declaración de permisos; es aprobable (Ruta Rentable está publicada), pero añade riesgo y tiempo. La alternativa es APK sideload.
5. **iOS no permite leer otras apps.** En iPhone solo cabría registro manual o compartir captura a la PWA para OCR. El asistente automático es **solo Android**.
6. **No se automatiza la aceptación.** Leer la pantalla localmente es distinto de manipular la app; aun así, las condiciones de DiDi pueden restringir el uso de asistentes. El riesgo es del usuario.

---

## 3. Enfoques posibles

### A. App Android compañera + overlay (recomendado para empezar)

Una app nativa pequeña ("DIDI Copiloto") que lee la oferta, calcula y muestra una tarjeta flotante sobre DiDi. El botón "Registrar" abre DIDI Pro con los datos precargados mediante un deep link (`?registrar=1&precio=...&km=...&min=...`).

- **Ventajas:** no toca la PWA actual; se valida rápido; se puede instalar por APK; menor riesgo.
- **Costes:** dos apps instaladas; el registro requiere un toque extra; configuración de metas duplicada (se puede importar/exportar JSON).

### B. Una sola app: DIDI Pro envuelta en WebView + servicios nativos

Un APK que carga la PWA dentro de un WebView y añade un puente JavaScript nativo (`@JavascriptInterface`). El overlay calcula con la configuración real de la PWA y, al pulsar "Registrar", inserta la carrera directamente en IndexedDB.

- **Ventajas:** una sola app; registro en un toque; una única configuración; experiencia integrada.
- **Costes:** más trabajo; hay que mantener el wrapper; el WebView no ofrece instalación PWA clásica (el sitio publicado sigue existiendo para iPhone/escritorio); probar Service Worker y persistencia dentro del WebView.

### C. Sin app nativa: captura manual o semi-automática

- **C1. Botón flotante manual:** un overlay con 3 campos (precio, km, min) que el conductor llena en 3–5 s. Cero permisos invasivos, pero no es automático.
- **C2. Notificación → Tasker/Automation → webhook:** solo si la notificación trae todos los datos; frágil, dependiente de una app de pago y de un servidor.
- **C3. Compartir captura → PWA con OCR:** la PWA se registra como destino de compartir (`share_target`); el usuario comparte la captura de la oferta y la app hace OCR. Funciona en Android e iPhone, pero son varios toques y no es en tiempo real.

**Recomendación:** **A** para la primera versión (validar captura + overlay + frases con riesgo bajo), y evaluar **B** como fase 2 si el registro en un solo toque compensa. **C1** puede convivir como modo de respaldo si falla la lectura automática.

---

## 4. Arquitectura recomendada (enfoque A)

```
┌────────────────────────────── Android ──────────────────────────────┐
│                                                                     │
│  DiDi Conductor (com.didiglobal.driver)                             │
│        │  oferta en pantalla / notificación                         │
│        ▼                                                            │
│  DIDI Copiloto                                                      │
│  ├── OfferCaptureService                                            │
│  │     ├── AccessibilityService  (primario)                         │
│  │     ├── NotificationListener  (disparador / fallback)            │
│  │     └── MediaProjection + ML Kit OCR (fallback opcional)         │
│  ├── OfferParser  → { precio, kmRecogida, minRecogida,              │
│  │                    kmViaje, minViaje }                           │
│  ├── DecisionEngine → COP/h, COP/km, semáforo, frase                │
│  ├── OverlayCard (TYPE_ACCESSIBILITY_OVERLAY)                       │
│  │     ├── 🟢/🟡/🔴  "$2.400/km · $41.000/h"                        │
│  │     ├── frase corta                                              │
│  │     └── [Registrar]  [Ignorar]                                   │
│  ├── Room (historial local de ofertas y decisiones)                 │
│  └── Deep link → DIDI Pro PWA (?registrar=1&...)                    │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
                    │
                    ▼
        DIDI Pro PWA (IndexedDB, reportes, respaldo)
```

### Flujo de una oferta

1. DiDi muestra la oferta.
2. El servicio de accesibilidad recibe `TYPE_WINDOW_STATE_CHANGED` / `TYPE_WINDOW_CONTENT_CHANGED` de `com.didiglobal.driver`.
3. Se espera un pequeño *debounce* (150–250 ms) a que el árbol esté completo.
4. `OfferParser` extrae los campos con patrones tolerantes:
   - **Precio:** todos los montos `$` de la tarjeta; se toma el mayor (el total) para no confundirlo con el desglose.
   - **Recogida y viaje:** `(\d+)\s*min\s*\(([\d.,]+)\s*km\)`, en orden de aparición (primera = recogida, segunda = viaje).
   - **Método:** `Efectivo` / `Tarjeta`.
   - **Direcciones:** se guardan solo para deduplicar y mostrar contexto.
   - Separadores `es-CO`: `.` para miles, `,` para decimales. Se normalizan antes de calcular.
5. `DecisionEngine` calcula:
   - `kmTotal = kmRecogida + kmViaje`
   - `minTotal = minRecogida + minViaje`
   - `copKm = precio / kmTotal`
   - `copHora = precio / (minTotal / 60)`
   - Semáforo con las mismas reglas de la PWA (metas configurables).
6. Se muestra el overlay en < 300 ms, con la frase explicativa. **Posición:** tarjeta compacta en la franja superior (zona del mapa), nunca sobre el botón `Aceptar` ni sobre el precio; ancho completo menos 16 px y altura máxima de ~120 px. El conductor debe poder seguir viendo la oferta original de DiDi.
7. El conductor acepta en DiDi (decisión suya). Si pulsa **Registrar**, se abre DIDI Pro con los campos precargados; el conductor confirma y la carrera entra al turno.
8. El overlay se oculta al desaparecer la oferta o a los 12 s.

### Motor de decisión y frases

Se reutilizan las reglas actuales del proyecto (README §Cálculos):

- 🟢 Excelente: cumple **ambas** metas (≥ $30.000/h y ≥ $2.000/km).
- 🟡 Aceptable: cumple una, o alcanza el 80 % de ambas.
- 🔴 No rentable: no alcanza los umbrales.

Generación de frases (plantillas con el dato que explica la decisión):

- 🟢 `"Vale la pena: $2.400/km y $41.000/h."`
- 🟢 `"Buena recogida: solo 0,8 km hasta el pasajero."`
- 🟡 `"Aceptable: cumple $/km, pero la hora va en $27.500."`
- 🔴 `"No conviene: 4,2 km de recogida te dejan en $890/km."`
- 🔴 `"No conviene: 22 min totales para $6.500 son $17.700/h."`
- ⚪ `"No pude leer la oferta. Ábrela un segundo más o registra manual."`

Las frases se generan localmente, sin IA ni red, para que sean instantáneas y funcionen offline.

### Datos y privacidad

- Todo ocurre en el dispositivo. Sin cuentas, sin servidores, sin telemetría.
- Room guarda solo las ofertas analizadas (precio, km, min, decisión, timestamp) para auditoría y para medir aciertos.
- El deep link a la PWA lleva los datos en la URL; no sale del teléfono.
- Permisos: Accesibilidad (lectura de pantalla), Notificaciones (opcional), Batería (exclusión), Overlay solo si se usa `TYPE_APPLICATION_OVERLAY`.

### Integración con la PWA

Cambio mínimo en `js/app.js`: al arrancar, leer `?registrar=1&precio=&km=&min=&metodo=` y abrir el modal de carrera precargado (mismo patrón que el `?view=` actual, línea ~3261). Sin backend.

En la fase 2 (enfoque B), el wrapper WebView llama directamente a una función JS expuesta (`window.didiRegistrarViaje`) y el overlay registra sin abrir nada.

---

## 5. Fases y tareas

### Fase 0 — Calibración con una oferta real (imprescindible)

**Objetivo:** saber qué datos expone realmente DiDi antes de escribir el parser.

1. Build de diagnóstico (sin overlay) que registra en un archivo local:
   - notificaciones de `com.didiglobal.driver` (título, texto, bigText);
   - árbol de accesibilidad de la ventana de oferta (nodos, textos, bounds).
2. El usuario abre la app, recibe 3–5 ofertas reales y exporta el log.
3. Analizar: ¿la notificación trae precio/km/min? ¿el árbol de accesibilidad los expone? ¿o hace falta OCR?
4. Congelar 5–10 fixtures anonimizados para tests.

**Criterio de salida:** decisión documentada de la fuente primaria (accesibilidad, notificación u OCR) y fixtures de prueba.

### Fase 1 — MVP del asistente (overlay + cálculo + frases)

1. Proyecto Android (Kotlin, minSdk 26, target 35) con una sola Activity de configuración.
2. `AccessibilityService` filtrado por paquete `com.didiglobal.driver` y eventos de ventana.
3. `OfferParser` con los patrones derivados de la fase 0 + tests unitarios con los fixtures.
4. `DecisionEngine` puro y testeable (mismas fórmulas y umbrales de la PWA).
5. Overlay compacto (no tapa los botones de DiDi; posición configurable) con semáforo, COP/h, COP/km, frase y botones.
6. Configuración: metas COP/h y COP/km, costo de gasolina, activar/desactivar frases, tamaño del overlay.
7. Deduplicación (misma oferta no se muestra dos veces) y auto-ocultado a los 12 s.
8. Modo manual de respaldo: botón flotante con 3 campos.

**Criterio de salida:** en un dispositivo real, 10 ofertas consecutivas muestran el overlay correcto en < 500 ms, con cálculo verificable a mano.

### Fase 2 — Disparador por notificación y robustez

1. `NotificationListenerService` como disparador temprano y fallback de datos.
2. Manejo de ciclo de vida: foreground service, reinicio tras reboot, exclusión de batería.
3. Detección de "no pude leer": mensaje claro y opción manual.
4. Registro local de latencia y aciertos para afinar.

**Criterio de salida:** el servicio sobrevive 8 horas de jornada sin morir en segundo plano y sin drenar más del 3 % de batería.

### Fase 3 — Puente con DIDI Pro

1. Deep link `?registrar=1&...` + precarga del modal en `js/app.js`.
2. Botón "Registrar" en el overlay.
3. Validación de datos y toast de confirmación en la PWA.
4. (Opcional) Enfoque B: wrapper WebView + puente JS para registro directo.

**Criterio de salida:** una oferta aceptada se registra en el turno activo con un solo toque y aparece en el historial y en IndexedDB.

### Fase 4 — Distribución y pulido

1. Icono, nombre, onboarding con explicación de permisos y privacidad.
2. APK firmado + instrucciones de instalación; o formulario de Play Store si se decide publicar.
3. Frases afinadas con el usuario (tono y prioridad de motivos).
4. (Opcional) OCR con ML Kit como fallback universal.
5. (Opcional) Soporte Uber (`com.ubercab.driver`) reutilizando el motor.

**Criterio de salida:** instalación limpia en un teléfono nuevo siguiendo solo el onboarding, sin errores.

---

## 6. Pruebas y verificación

- **Unitarias:** parser con fixtures reales (precio con separadores, km con coma, ofertas sin datos, textos repetidos); motor de decisión con los tres semáforos y los bordes (80 %, metas en 0).
- **Instrumentadas:** servicio de accesibilidad con ventanas simuladas; overlay no interactivo donde debe.
- **En dispositivo:** 10 ofertas reales por jornada durante 3 jornadas; comparar el cálculo de la app con el cálculo manual.
- **Regresión PWA:** la PWA publicada sigue cargando con 0 errores y el deep link no rompe `?view=`.
- **Batería:** medir con AccuBattery o `dumpsys batterystats` en una jornada de 8 h.
- **Privacidad:** confirmar que no hay tráfico de red saliente salvo los CDNs de la PWA.

---

## 7. Riesgos y mitigaciones

| Riesgo | Impacto | Mitigación |
| :--- | :--- | :--- |
| DiDi cambia el formato de la oferta | El parser deja de leer | Parser tolerante + fixtures + fallback OCR + modo manual |
| DiDi usa renderizado sin nodos de accesibilidad | No hay datos | Fase 0 lo detecta; OCR ML Kit como plan B |
| El fabricante mata el servicio | Se pierden ofertas | Foreground service + exclusión de batería + onboarding por marca |
| Latencia > 1 s | La oferta expira | Pipeline sin red, debounce corto, overlay inmediato con "calculando" |
| Play Store rechaza el uso de Accesibilidad | No se puede publicar | Sideload para uso personal; o declaración con justificación |
| Condiciones de DiDi prohíben asistentes | Riesgo de cuenta | Solo aconseja, no automatiza; el usuario decide; documentar el riesgo |
| Falsos positivos/negativos | Decisiones malas | Mostrar siempre el cálculo, no solo el color; registrar y revisar |
| Doble app (enfoque A) | Fricción | Evaluar wrapper (enfoque B) en fase 2 |

---

## 8. Métricas de éxito

- Overlay visible en **< 500 ms** desde que aparece la oferta.
- **≥ 95 %** de ofertas parseadas correctamente en pruebas reales.
- **0** aceptaciones/rechazos automáticos.
- **< 3 %** de batería en 8 h.
- El conductor declara que la frase le ayudó a rechazar al menos una carrera mala por jornada.

---

## 9. Decisiones abiertas (para aprobar)

1. **¿Teléfono Android o iPhone?** Si es iPhone, el enfoque automático no es posible y hay que replantear (manual u OCR por captura).
2. **¿App compañera (A) o una sola app que envuelva el PWA (B)?** Recomiendo A para la primera versión.
3. **¿Distribución por APK sideload o Play Store?** Sideload evita la revisión de Accesibilidad; Play da actualizaciones y confianza.
4. **¿Registrar la carrera automáticamente al detectar que aceptaste, o solo cuando pulses "Registrar"?** Recomiendo el botón para no contaminar los datos.
5. **¿Frases con qué tono?** Directo y numérico ("$890/km, no conviene") vs. más conversacional ("esta recogida te come la ganancia").
6. **¿También Uber e InDrive?** El motor es reutilizable; cada app requiere su parser.
7. **¿Los 35 min del viaje ya incluyen los 8 min de recogida?** Es el único dato ambiguo de la captura y cambia el COP/h en ~5.000.
8. **¿Metas actuales confirmadas?** El ejemplo sale 🔴 con $30.000/h y $2.000/km. Si tus metas reales son otras, se configuran en la app.

---

## 10. Fuentes

- Android `NotificationListenerService`: <https://developer.android.com/reference/android/service/notification/NotificationListenerService>
- Política de Play sobre `AccessibilityService`: <https://support.google.com/googleplay/android-developer/answer/10964491>
- Overlay con `TYPE_ACCESSIBILITY_OVERLAY`: <https://developer.android.com/reference/android/view/WindowManager.LayoutParams>
- Prior art: <https://collabocore.com/automatizaciones/optimizacion-de-viajes/>, <https://rutarentable.app/>, <https://rutapro.app/colombia>
- Web Share Target (fallback OCR en PWA): <https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/share_target>
