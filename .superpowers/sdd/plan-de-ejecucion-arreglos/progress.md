# SDD ledger — plan: plan de ejecucion arreglos.txt (FASE 1)

## Pre-flight
- Repo: main @ 687ef73, limpio (solo plan txt sin trackear).
- Estructura de carpetas ya migrada a css/, js/, assets/icons (según PLAN_EXECUCION_GIT.md).
- Tareas F1: (1) Limpieza markup/rutas index.html, (2) Fix CTA/responsive styles.css, (3) sw.js + registro en app.js.

## Progreso (FASE 2)
- Task 1 (Toast system): complete — `showToast(mensaje, tipo, duracion)` centralizado con contenedor `#toast-container`, iconos Lucide, auto-cierre animado. Reemplazados los 4 `alert()` de validación (viaje ×3, tanqueada ×1) y el de exportación CSV (info). Toasts de éxito añadidos en guardar carrera/tanqueada, eliminar registros y reiniciar jornada.
- Task 2 (Modal confirmación): complete — `confirmDialog(mensaje, titulo)` basado en Promesa con 3 botones (Sí/No/X) y Escape. Reemplazados los 3 `window.confirm()` (eliminarViaje, eliminarTanqueada, reiniciarJornada). Handlers por asignación `onclick` para evitar acumulación.
- Task 3 (Bottom Nav SPA): complete — barra inferior fija de 4 pestañas (Turno/Calculadora/Historial/Ajustes) con switch de vistas sin recarga (`inicializarNavegacion()`), scroll al top. Dashboard en `view-turno`; tabla de historial movida a `view-historial`; `view-calculadora` y `view-ajustes` son placeholders (contenidos completos en Fases 4 y 3/5 según plan).
- Ruling Fase 2: Calculadora y Ajustes quedan como paneles placeholder — el plan define su contenido en Fases 4 y 5 respectivamente; coste si falla: pestañas "vacías" temporalmente.
- Ruling Fase 2: CTA elevado a `bottom: 90px` en móvil y toasts a `158px` para no solapar la bottom nav (~60px); en desktop CTA vuelve a `bottom:16px` y toasts a `80px` sobre sidebar — coste si falla: solapamiento visual en móviles con notch.
- Verificación browser-qa: 0 pageerror / 0 console.error / 0 warn; switch de 4 pestañas OK; promesas del modal OK (cancel=false, confirm=true); toasts apilados OK (3 simultáneos); E2E registrar→eliminar viaje→reiniciar jornada OK; node --check OK.
- Commit: pendiente → push a github.com/fresteban2010/proyecto-didi (main).
- Task 1 (markup/rutas index.html): complete — eliminado texto residual `play_circle`, agregado `viewport-fit=cover`, corregidas rutas relativas del manifest (start_url/scope/icons resolvían a `/assets/icons/assets/icons/...` → 404). Ruling: el plan solo pedía "normalizar rutas del manifest"; el bug real era que las rutas del manifest se resuelven relativas a su propia ubicación — coste si falla: PWA no instalable.
- Task 2 (CTA/responsive styles.css): complete — regla desktop de `.fixed-cta-container` reescrita (fixed + right:24 + bottom:16, sin `sticky` ni `translateX(-50%)`), `overflow-x:hidden` en body. Verificado en vivo: CTA dentro de ventana, 0 overflow horizontal.
- Task 3 (sw.js + registro app.js): complete — SW con SWR local / Cache-First CDN / Network-First navegación; registro con guard file:// y ciclo `updatefound`+`SKIP_WAITING`. Verificado: SW `activated`, cache `didi-tracker-v1` con 11 assets.
- Tests (browser-qa, http://localhost:8080): 0 pageerror / 0 console.error / 0 warn; HTTP 200; iconos y start_url del manifest → 200.
- Commit: 03ec4ad → push a github.com/Fresteban2010/proyecto-didi (main).
- Final review: self-review (verificación en vivo con browser-qa de todos los criterios de aceptación de la fase).
