# RESUMEN TÉCNICO — DIDI Pro

Documento de referencia para mantener el proyecto: qué existe, cómo funciona y qué decisiones se tomaron.

---

## 1. Componentes

| Componente | Ubicación | Tecnología |
| :--- | :--- | :--- |
| DIDI Tracker (PWA) | raíz (`index.html`, `css/`, `js/`, `manifest.json`, `sw.js`) | HTML/CSS/JS vanilla, IndexedDB, Chart.js, Service Worker |
| DIDI Copiloto (Android) | `android/` | Kotlin, AccessibilityService, NotificationListener, ML Kit OCR |
| Publicación PWA | GitHub Pages desde `main` | `https://fresteban2010.github.io/Proyecto-DIDI/` |
| APK | GitHub Actions / Releases `android-v*` | sideload, firma estable en `android/app/didi-sideload.keystore` |

---

## 2. PWA (DIDI Tracker)

- **Estado:** todo en el dispositivo. `IndexedDB` (`DidiTrackerDB`, v1) es la fuente de verdad; `localStorage` es espejo/fallback.
- **Almacenes:** `jornadas`, `viajes` (índice `jornadaId`), `tanqueadas`, `gastosPuntuales`, `config`.
- **Service Worker:** `didi-tracker-v10`; navegación Network-First, assets Stale-While-Revalidate, CDNs Cache-First.
- **Instalación:** manifest raíz con `id`, `start_url`, `scope`, iconos `any`/`maskable`, capturas, atajos (`?view=`).
- **Registro desde el copiloto:** `?registrar=1&precio=...&kmRecogida=...&minRecogida=...&kmViaje=...&minViaje=...&metodo=...` abre el modal detallado, valida los datos y limpia la URL.
- **Privacidad:** el respaldo JSON solo sale del teléfono cuando el usuario lo exporta.

### Diseño móvil

- Cabecera no fija; se desplaza con el contenido.
- Barra inferior de 5 ítems: Turno, Calculadora, **+ Registrar**, Historial, Ajustes.
- Audio y Reiniciar Jornada también en Ajustes.
- Animaciones con `prefers-reduced-motion`.

---

## 3. DIDI Copiloto (Android)

### 3.1 Pipeline

```text
DiDi en primer plano
  ├─ AccessibilityService: eventos + árbol (casi vacío en DiDi)
  └─ Muestreo periódico cada 1,5 s
        └─ takeScreenshot
              └─ ML Kit OCR (líneas + coordenadas)
                    ├─ ¿Es nuestra propia notificación? → ignorar (ocr_propio)
                    ├─ ¿Es Centro de solicitudes? → lista: capturar sin notificar
                    └─ Oferta popup → DecisionEngine → notificación heads-up
```

- **Popup:** oferta que salta. Se notifica aunque diga “Pon tu precio”.
- **Lista:** `Centro de solicitudes` / `Km al encuentro`. No notifica; se procesan las tarjetas “Pon tu precio”.
- **Filtro antibucle:** si el OCR lee `DIDI Copiloto` + `Registrar/Ignorar` + `/km` o `/h`, se descarta.
- **Tarjetas:** se agrupan por `Aceptar` y, si falta, por precio + tramos (respaldo).
- **Solo completas:** precio + recogida + viaje. Las incompletas no se muestran.
- **Imagen:** recorte de la tarjeta (no pantalla completa).
- **Análisis:** `DecisionEngine` calcula COP/km, COP/h, gasolina, neto y semáforo.

### 3.2 Clases principales

| Archivo | Responsabilidad |
| :--- | :--- |
| `offer/OfferAccessibilityService.kt` | Servicio, eventos, muestreo, captura, filtros y coordinación |
| `offer/OfferOcr.kt` | ML Kit + `LineaOcr` con coordenadas |
| `offer/OfferParser.kt` | Oferta popup (precio, tramos, método) |
| `offer/DecisionEngine.kt` | Cálculo y semáforo |
| `offer/PantallaOferta.kt` | Clasificación: notificación propia / lista / Pon tu precio |
| `offer/OfferNotifier.kt` | Canal, notificación y acciones Registrar/Ignorar |
| `pon_tu_precio/PonTuPrecioParser.kt` | Tarjetas de la lista, rectángulos y ofertas individuales |
| `pon_tu_precio/PonTuPrecioRepository.kt` | Persistencia JSON, tope 50, deduplicación |
| `ui/PonTuPrecioActivity.kt` | Pantalla de ofertas individuales |
| `diag/DiagnosticLog.kt` | Log local `diagnostico.jsonl` |

### 3.3 Persistencia y permisos

- `SharedPreferences` (`didi_copiloto_settings`): metas, combustible, recogida, notificaciones, overlay.
- `files/pon_tu_precio/`: imágenes recortadas + `index.json`.
- `files/diagnostico/`: log rotativo (máx. 2 MB).
- Permisos: Accesibilidad, acceso a notificaciones (opcional), `POST_NOTIFICATIONS`, exclusión de batería.

### 3.4 Rendimiento

- Muestreo cada 1,5 s; reintento por eventos cada 0,8 s.
- OCR y guardado en segundo plano (executor de un hilo).
- Capturas de lista separadas por al menos 2 s; misma pantalla 15 s.
- Deduplicación por precio + km/min (30 min).
- Diagnóstico: `ocr_ms` y `ms` de cada captura.

---

## 4. Pruebas y CI

- **48 pruebas unitarias** Android: parser popup, tarjetas, clasificación, motor, ajustes y puente PWA.
- Workflow `.github/workflows/android.yml`: tests, APK release y artifact; tags `android-v*` crean Release con `didi-copiloto.apk`.
- Firma estable de sideload en el repo; no cambiar el keystore (permite actualizar sin desinstalar).

---

## 5. Limitaciones conocidas

- DiDi puede cambiar su UI; el parser se calibra con `diagnostico.jsonl`.
- La accesibilidad de DiDi expone muy poco texto; el OCR es la fuente principal.
- El muestreo cada 1,5 s consume más batería; se puede subir a 2 s.
- Una tarjeta que no se ve completa no se guarda hasta la siguiente captura.
- Solo Android (iOS no permite leer la pantalla de otras apps).
- Fabricantes agresivos con segundo plano (Realme/OPPO/Xiaomi) pueden requerir exclusión de batería.

---

## 6. Referencias

- [README principal](../README.md)
- [README del copiloto](../android/README.md)
- [Changelog](../CHANGELOG.md)
- Planes y especificaciones: `docs/superpowers/`
