# SDD ledger — plan: plan de ejecucion arreglos.txt (FASE 1)

## Pre-flight
- Repo: main @ 687ef73, limpio (solo plan txt sin trackear).
- Estructura de carpetas ya migrada a css/, js/, assets/icons (según PLAN_EXECUCION_GIT.md).
- Tareas F1: (1) Limpieza markup/rutas index.html, (2) Fix CTA/responsive styles.css, (3) sw.js + registro en app.js.

## Progreso (FASE 4)
- Task 1 (modo rápido): complete — selector segmentado `Modo Rápido` / `Desglose Detallado` en el modal de viaje; modo rápido con solo 3 campos (distancia total, tiempo total, valor DiDi), `required` conmutado por modo, sincronización de valores al alternar y edición forzada a detallado para conservar el desglose.
- Task 2 (audio sintético): complete — `AudioContext` creado/desbloqueado al primer gesto (`pointerdown`/`keydown`); osciladores senoidales con envolvente anti-clic: verde 880→1200 Hz dual 120 ms, amarillo 660 Hz 150 ms, rojo 330→220 Hz 200 ms. Interruptor de silencio en cabecera persistido en `config.audioSilenciado` (IndexedDB + espejo). Hook `window.__ultimoTono` para QA.
- Task 3 (calculadora): complete — pestaña 2 con 3 campos, teclado numérico en pantalla, evaluación instantánea (COP/h, COP/km, semáforo dinámico y veredicto vs metas), botón "Aceptar y Registrar" que crea la carrera, guarda en IndexedDB, emite el tono y muestra toast; "Limpiar" para la siguiente propuesta.
- Fix de datos (Fase 3): `tiempoRecogidaMin`/`tiempoEntregaMin` no se persistían en IndexedDB (solo `tTotal`), por lo que tras recargar COP/h se recalculaba en 0 y degradaba en cascada. Ahora se guardan los campos de detalle y `normalizarViajeDesdeDB()` repara registros antiguos usando `dTotal`/`tTotal` como fallback.
- Ruling Fase 4: modo rápido es el predeterminado al crear; editar un viaje abre siempre en detallado — coste si falla: un clic extra al editar.
- Ruling Fase 4: la calculadora registra con método "Efectivo" por defecto (editable después en el historial) — el plan no pedía selector de método ahí.
- Verificación browser-qa v2 (perfil persistente + gestos reales): calculadora 5.7 km/18 min/$12.000 → 40.000 COP/h y 2.105 COP/km verdes; aceptar registra y emite tono con `AudioContext.state = running`; modo rápido guarda 2 viajes y crea tono rojo; silencio persiste (`aria-pressed=true`) y suprime tonos; edición abre detallada con 18 min/5.7 km y al pasar a rápido sincroniza; recarga desde IndexedDB conserva `tiempoEntregaMin` y recalcula 40.000 COP/h en tabla; escritorio 1440x900 con 2 columnas, sidebar 88px y sin overflow; consola/red/diálogos: 0.
- Commit: pendiente → push a github.com/fresteban2010/proyecto-didi (main).

- Task 1 (capa IndexedDB): complete — `js/db.js` con `DidiTrackerDB` v1 y 5 almacenes del plan (`jornadas`, `viajes`, `tanqueadas`, `gastosPuntuales`, `config`), índices `jornadaId` en los 3 hijos, operaciones promisificadas, upsert limpio de jornada (delete+put transaccional en orden), export/import completos y validación de integridad (secciones + schema).
- Task 2 (fuente de la verdad + migración): complete — `cargarDatos()` async prioriza IndexedDB, con fallback a localStorage si IDB falla; `guardarDatos()` espeja en localStorage y persiste jornada+viajes+tanqueadas+config en IDB; migración transparente e idempotente desde `didi_tracker_data` (fechaInicio, viajes con métricas calculadas, tanqueadas y config preservados).
- Task 3 (respaldo/restauración Google Drive): complete — panel real en Ajustes con exportar/importar + estadísticas de almacenamiento. Export: Web Share API (móvil → menú compartir → Drive) → File System Access API (PC → carpeta) → descarga fallback. Import: `<input type=file>` + validación + restauración transaccional + recarga de estado y toasts.
- Fix adicional: SW cache v2 incluye `db.js`, y ante `controllerchange` (nueva versión) la página recarga una sola vez para evitar mezclar assets viejos con lógica nueva de datos.
- Ruling Fase 3: IndexedDB es la fuente de la verdad y localStorage queda como espejo/fallback (no se elimina) — coste si falla: doble escritura, sin pérdida de datos.
- Ruling Fase 3: Google Drive se implementa vía Web Share API / File System Access API (lo que pide el plan), sin OAuth ni client-id — coste si falla: el respaldo se guarda manualmente en Drive, sin sync automática.
- Verificación browser-qa (una sola sesión; cada llamada del MCP usa contexto aislado): 5 almacenes + índices OK; 2 viajes + 1 tanqueada persistidos con métricas; recarga simulada desde IDB restaura todo ($31.000 UI); export→limpiar→restaurar con coincidencia exacta (JSON.stringify) y misma jornada; estadísticas UI OK; export/import reales por UI con toasts; validaciones rechazan respaldo incompleto y schema inválido; migración legacy 2 viajes/1 tanqueada/config OK e idempotente; consola 0 errores.
- Commit: 11d4c9c → push a github.com/fresteban2010/proyecto-didi (main).
- Final review: self-review (aceptación verificada en vivo dentro de una sesión: esquema, persistencia, round-trip exacto, migración e idempotencia; sintaxis con node --check).

- Task 1 (Toast system): complete — `showToast(mensaje, tipo, duracion)` centralizado con contenedor `#toast-container`, iconos Lucide, auto-cierre animado. Reemplazados los 4 `alert()` de validación (viaje ×3, tanqueada ×1) y el de exportación CSV (info). Toasts de éxito añadidos en guardar carrera/tanqueada, eliminar registros y reiniciar jornada.
- Task 2 (Modal confirmación): complete — `confirmDialog(mensaje, titulo)` basado en Promesa con 3 botones (Sí/No/X) y Escape. Reemplazados los 3 `window.confirm()` (eliminarViaje, eliminarTanqueada, reiniciarJornada). Handlers por asignación `onclick` para evitar acumulación.
- Task 3 (Bottom Nav SPA): complete — barra inferior fija de 4 pestañas (Turno/Calculadora/Historial/Ajustes) con switch de vistas sin recarga (`inicializarNavegacion()`), scroll al top. Dashboard en `view-turno`; tabla de historial movida a `view-historial`; `view-calculadora` y `view-ajustes` son placeholders (contenidos completos en Fases 4 y 3/5 según plan).
- Ruling Fase 2: Calculadora y Ajustes quedan como paneles placeholder — el plan define su contenido en Fases 4 y 5 respectivamente; coste si falla: pestañas "vacías" temporalmente.
- Ruling Fase 2: CTA elevado a `bottom: 90px` en móvil y toasts a `158px` para no solapar la bottom nav (~60px); en desktop CTA vuelve a `bottom:16px` y toasts a `80px` sobre sidebar — coste si falla: solapamiento visual en móviles con notch.
- Verificación browser-qa: 0 pageerror / 0 console.error / 0 warn; switch de 4 pestañas OK; promesas del modal OK (cancel=false, confirm=true); toasts apilados OK (3 simultáneos); E2E registrar→eliminar viaje→reiniciar jornada OK; node --check OK.
- Commit: 7116b74 → push a github.com/fresteban2010/proyecto-didi (main).
- Final review: self-review (verificación en vivo de los 3 criterios Browser-QA de la fase; sintaxis validada con node --check).
- Task 1 (markup/rutas index.html): complete — eliminado texto residual `play_circle`, agregado `viewport-fit=cover`, corregidas rutas relativas del manifest (start_url/scope/icons resolvían a `/assets/icons/assets/icons/...` → 404). Ruling: el plan solo pedía "normalizar rutas del manifest"; el bug real era que las rutas del manifest se resuelven relativas a su propia ubicación — coste si falla: PWA no instalable.
- Task 2 (CTA/responsive styles.css): complete — regla desktop de `.fixed-cta-container` reescrita (fixed + right:24 + bottom:16, sin `sticky` ni `translateX(-50%)`), `overflow-x:hidden` en body. Verificado en vivo: CTA dentro de ventana, 0 overflow horizontal.
- Task 3 (sw.js + registro app.js): complete — SW con SWR local / Cache-First CDN / Network-First navegación; registro con guard file:// y ciclo `updatefound`+`SKIP_WAITING`. Verificado: SW `activated`, cache `didi-tracker-v1` con 11 assets.
- Tests (browser-qa, http://localhost:8080): 0 pageerror / 0 console.error / 0 warn; HTTP 200; iconos y start_url del manifest → 200.
- Commit: 03ec4ad → push a github.com/Fresteban2010/proyecto-didi (main).
- Final review: self-review (verificación en vivo con browser-qa de todos los criterios de aceptación de la fase).
