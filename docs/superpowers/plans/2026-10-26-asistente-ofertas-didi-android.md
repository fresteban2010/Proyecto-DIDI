# DIDI Copiloto (Android) — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Una app Android instalable por sideload que lea la oferta de DiDi Conductor, calcule su rentabilidad y muestre un overlay con semáforo y una frase, sin aceptar ni rechazar por el conductor.

**Architecture:** App Kotlin nativa dentro de `android/`. Un `AccessibilityService` lee el árbol de la ventana de `com.didiglobal.driver`, un parser puro extrae precio/tiempos/distancias, un motor puro decide el semáforo y una tarjeta flotante (`TYPE_ACCESSIBILITY_OVERLAY`) muestra el resultado. El botón “Registrar” abre la PWA con parámetros en la URL; no hay backend ni telemetría.

**Tech Stack:** Kotlin, AndroidX (AppCompat, Material, Core-KTX), Gradle 8.9 + AGP 8.5, JUnit 4, GitHub Actions para compilar el APK.

**Spec:** `docs/superpowers/specs/2026-10-26-asistente-ofertas-didi-design.md`

## Global Constraints

- Paquete: `com.fresteban.didicopiloto`. `minSdk 26`, `compileSdk 35`, `targetSdk 35`.
- Solo Android. Sin backend, sin cuentas, sin analytics, sin red en el camino crítico.
- La app **aconseja**; nunca pulsa Aceptar/Rechazar en DiDi.
- Números en formato `es-CO`: `.` para miles, `,` para decimales.
- Metas por defecto: `$30.000/h`, `$2.000/km`, gasolina `$16.000/gal`, `40 km/gal`.
- El overlay va en la franja superior y nunca sobre el botón `Aceptar`.
- Instalación por APK (sideload). No se publica en Play Store.
- URL de la PWA: `https://fresteban2010.github.io/Proyecto-DIDI/`.
- Todo el código Android vive bajo `android/`; no se mueve ni se rompe la PWA.

## Review Focus

- Oferta con separadores es-CO (`$16.206`, `1,9 km`) → el parser no debe confundir miles con decimales.
- Pantalla sin datos suficientes o texto partido → no mostrar un veredicto falso; ofrecer modo manual.
- Overlay sobre DiDi → no debe tapar `Aceptar` ni robar toques fuera de sus botones.
- Servicio tras reinicio, actualización o cambio de app → no debe crashear ni duplicar la tarjeta.
- Deep link con datos inválidos → la PWA no debe romperse ni registrar una carrera basura.

---

### Task 1: Andamiaje del proyecto + CI que produce el APK

**Files:**
- Create: `android/settings.gradle.kts`, `android/build.gradle.kts`, `android/gradle.properties`
- Create: `android/app/build.gradle.kts`, `android/app/src/main/AndroidManifest.xml`
- Create: `android/app/src/main/java/com/fresteban/didicopiloto/MainActivity.kt`
- Create: `android/app/src/main/res/values/strings.xml`, `themes.xml`, `colors.xml`
- Create: `.github/workflows/android.yml`

**Interfaces:**
- Produces: proyecto Gradle compilable; `MainActivity` vacía que muestra “DIDI Copiloto”.

- [ ] **Step 1:** Crear el proyecto Gradle con `applicationId com.fresteban.didicopiloto` y `MainActivity` mínima.
- [ ] **Step 2:** Configurar GitHub Actions (`ubuntu-latest`, JDK 17) para `./gradlew assembleDebug` y subir el APK como artifact.
- [ ] **Step 3:** Verificar `./gradlew :app:assembleDebug` en local (o el run verde de Actions).
- [ ] **Step 4:** Commit `chore(android): andamiaje del proyecto y CI`.

### Task 2: Ajustes y onboarding

**Files:**
- Create: `android/app/src/main/java/com/fresteban/didicopiloto/data/SettingsRepository.kt`
- Create: `android/app/src/main/java/com/fresteban/didicopiloto/ui/SettingsActivity.kt`
- Create: `android/app/src/main/res/layout/activity_settings.xml`
- Test: `android/app/src/test/java/com/fresteban/didicopiloto/data/SettingsRepositoryTest.kt`

**Interfaces:**
- Produces: `data class MetaConfig(metaCopHora: Int, metaCopKm: Int, precioGalonCOP: Int, rendimientoKmGalon: Double, viajeIncluyeRecogida: Boolean)`; `SettingsRepository(context).load(): MetaConfig` y `.save(config)`.

- [ ] **Step 1:** Test que guarda y relee `MetaConfig` con valores no default.
- [ ] **Step 2:** Implementar `SettingsRepository` sobre `SharedPreferences`.
- [ ] **Step 3:** Pantalla con metas, gasolina, switch “el viaje incluye la recogida”, botón a Accesibilidad y botón a Batería.
- [ ] **Step 4:** Tests en verde y commit `feat(android): ajustes y onboarding`.

### Task 3: Modelo y parser de ofertas

**Files:**
- Create: `android/app/src/main/java/com/fresteban/didicopiloto/offer/Offer.kt`
- Create: `android/app/src/main/java/com/fresteban/didicopiloto/offer/OfferParser.kt`
- Test: `android/app/src/test/java/com/fresteban/didicopiloto/offer/OfferParserTest.kt`

**Interfaces:**
- Produces:
  ```kotlin
  data class Offer(
      val precioCOP: Long,
      val kmRecogida: Double,
      val minRecogida: Int,
      val kmViaje: Double,
      val minViaje: Int,
      val metodoPago: String,
      val direccionRecogida: String? = null,
      val direccionDestino: String? = null,
      val crudo: String = ""
  )
  object OfferParser { fun parse(textos: List<String>, viajeIncluyeRecogida: Boolean = false): Offer? }
  ```

- [ ] **Step 1:** Test con la oferta real: `["Efectivo","$16.206","8 min (1,9 km)","35 min (11,2 km)","Aceptar"]` → `16206`, `1.9`, `8`, `11.2`, `35`.
- [ ] **Step 2:** Test de textos partidos (`"$16."`, `"206"`), montos del desglose y ausencia de datos → `null`.
- [ ] **Step 3:** Implementar el parser (precio = monto mayor; tramos con `(\d+)\s*min\s*\(([\d.,]+)\s*km\)`; método `Efectivo|Tarjeta`).
- [ ] **Step 4:** Tests en verde y commit `feat(android): parser de ofertas es-CO`.

### Task 4: Motor de decisión y frases

**Files:**
- Create: `android/app/src/main/java/com/fresteban/didicopiloto/offer/DecisionEngine.kt`
- Test: `android/app/src/test/java/com/fresteban/didicopiloto/offer/DecisionEngineTest.kt`

**Interfaces:**
- Produces:
  ```kotlin
  enum class Semaforo { VERDE, AMARILLO, ROJO }
  data class Decision(
      val kmTotal: Double, val minTotal: Int, val copKm: Double, val copHora: Double,
      val gasolinaCOP: Long, val netoCOP: Long, val semaforo: Semaforo, val frase: String
  )
  object DecisionEngine { fun evaluar(offer: Offer, config: MetaConfig): Decision }
  ```

- [ ] **Step 1:** Tests de los tres semáforos y de los bordes (80 % de ambas metas).
- [ ] **Step 2:** Test de la oferta real → `1237.1` COP/km, `22613` COP/h, ROJO, gasolina `5240`, neto `10966`.
- [ ] **Step 3:** Test de `viajeIncluyeRecogida=true` → `27782` COP/h.
- [ ] **Step 4:** Implementar el motor y las frases; commit `feat(android): motor de decisión`.

### Task 5: Captura por accesibilidad + diagnóstico

**Files:**
- Create: `android/app/src/main/java/com/fresteban/didicopiloto/offer/OfferAccessibilityService.kt`
- Create: `android/app/src/main/res/xml/accessibility_config.xml`
- Create: `android/app/src/main/java/com/fresteban/didicopiloto/diag/DiagnosticLog.kt`
- Modify: `android/app/src/main/AndroidManifest.xml`

**Interfaces:**
- Produces: servicio que, al detectar una oferta, llama a `OfferPipeline.onOfferTexts(textos)`; `DiagnosticLog.append(context, json)` escribe en `filesDir/diagnostico.jsonl`.

- [ ] **Step 1:** Servicio filtrado por `com.didiglobal.driver`, `canRetrieveWindowContent=true`, eventos de ventana y contenido.
- [ ] **Step 2:** Recorrer nodos, ordenar por `boundsInScreen.top/left`, unir `text` + `contentDescription`.
- [ ] **Step 3:** Debounce 200 ms + dedupe por hash 8 s; escribir cada oferta cruda al log de diagnóstico.
- [ ] **Step 4:** Verificar con una pantalla mock (textos de la captura) que el servicio dispara una vez.
- [ ] **Step 5:** Commit `feat(android): captura por accesibilidad y log de diagnóstico`.

### Task 6: Overlay con semáforo y frase

**Files:**
- Create: `android/app/src/main/java/com/fresteban/didicopiloto/offer/OfferOverlay.kt`
- Create: `android/app/src/main/res/layout/overlay_offer.xml`
- Create: `android/app/src/main/res/drawable/bg_overlay.xml`
- Modify: `OfferAccessibilityService.kt`

**Interfaces:**
- Consumes: `Offer`, `Decision`.
- Produces: `OfferOverlay.show(offer, decision, onRegister, onDismiss)` / `.hide()`.

- [ ] **Step 1:** Inflar tarjeta compacta con color de semáforo, `$X/km`, `$Y/h` y frase.
- [ ] **Step 2:** Añadir con `TYPE_ACCESSIBILITY_OVERLAY`, `FLAG_NOT_FOCUSABLE`, `gravity=TOP`, `y=80dp`.
- [ ] **Step 3:** Auto-ocultar a los 12 s y al cambiar de ventana; botones Registrar/Ignorar.
- [ ] **Step 4:** Test manual con pantalla mock: el overlay no cubre la zona del botón Aceptar.
- [ ] **Step 5:** Commit `feat(android): overlay de recomendación`.

### Task 7: Puente con la PWA

**Files:**
- Create: `android/app/src/main/java/com/fresteban/didicopiloto/bridge/PwaBridge.kt`
- Modify: `js/app.js` (lector de `?registrar=`)
- Test: `android/app/src/test/java/com/fresteban/didicopiloto/bridge/PwaBridgeTest.kt`

**Interfaces:**
- Produces: `PwaBridge.buildUrl(offer, baseUrl): String` con `registrar=1`, `precio`, `kmRecogida`, `minRecogida`, `kmViaje`, `minViaje`, `metodo`.
- In the PWA: `leerParametrosRegistro()` que abre el modal detallado y precarga los campos; limpia la URL con `history.replaceState`.

- [ ] **Step 1:** Test de la URL generada con la oferta real (orden y codificación estables).
- [ ] **Step 2:** Implementar `PwaBridge` y el botón “Registrar” del overlay.
- [ ] **Step 3:** En `js/app.js`, leer parámetros, validar rangos, abrir modal y precargar; ignorar parámetros inválidos.
- [ ] **Step 4:** Verificar con `browser-qa` que `?registrar=1&precio=16206&kmRecogida=1.9&minRecogida=8&kmViaje=11.2&minViaje=35&metodo=efectivo` abre el modal con los valores.
- [ ] **Step 5:** Commit `feat: puente de registro entre el copiloto y la PWA`.

### Task 8: Notificaciones, arranque y robustez

**Files:**
- Create: `android/app/src/main/java/com/fresteban/didicopiloto/notify/OfferNotificationListener.kt`
- Create: `android/app/src/main/java/com/fresteban/didicopiloto/BootReceiver.kt`
- Modify: `AndroidManifest.xml`, `MainActivity.kt`

**Interfaces:**
- Produces: notificaciones de DiDi se registran en el log de diagnóstico; si contienen precio/km/min, se usan como disparador temprano.

- [ ] **Step 1:** `NotificationListenerService` filtrado por `com.didiglobal.driver` (título, texto, bigText) al log.
- [ ] **Step 2:** `BootReceiver` que comprueba si el servicio sigue habilitado y avisa con notificación si no.
- [ ] **Step 3:** Botón “Compartir diagnóstico” con `FileProvider`.
- [ ] **Step 4:** Prueba de 30 min con pantalla mock y cambio de apps; sin crashes ni duplicados.
- [ ] **Step 5:** Commit `feat(android): notificaciones, arranque y diagnóstico compartible`.

### Task 9: APK de release y documentación de instalación

**Files:**
- Create: `android/README.md`
- Modify: `.github/workflows/android.yml` (release en tag `android-v*`)
- Create: `android/keystore.properties.example`

**Interfaces:**
- Produces: APK `app-debug.apk` como artifact y APK firmado en GitHub Releases al etiquetar.

- [ ] **Step 1:** Documentar instalación sideload, “Permitir ajustes restringidos” (Android 13+), accesibilidad y batería.
- [ ] **Step 2:** Configurar release con keystore desde secrets (`ANDROID_KEYSTORE_BASE64`, alias, passwords).
- [ ] **Step 3:** Generar el primer tag `android-v0.1.0` y verificar la descarga del APK.
- [ ] **Step 4:** Commit `docs(android): instalación sideload y release`.

---

## Verificación final

- `./gradlew test` en verde (parser, motor, settings, bridge).
- APK instalado en un teléfono real: activar accesibilidad, recibir 3 ofertas y comparar el cálculo a mano.
- El overlay aparece en < 500 ms, no tapa `Aceptar` y se oculta solo.
- “Registrar” abre la PWA con los datos y no registra nada sin confirmación.
- 0 crashes en 8 h; consumo < 3 % de batería.
