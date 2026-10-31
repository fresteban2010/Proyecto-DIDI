# DIDI Copiloto (Android)

App nativa que lee la oferta de **DiDi Conductor**, calcula si la carrera conviene y **te avisa con una notificación** (semáforo, COP/km y COP/h). La tarjeta flotante sobre DiDi queda como opción experimental. **No acepta ni rechaza viajes**: solo aconseja.

Se instala por **sideload** (APK). No requiere Play Store, cuenta, servidor ni internet.

**Versión actual:** `0.6.0` (versionCode 13).
**Documentación:** [Changelog](../CHANGELOG.md) · [Resumen técnico](../docs/RESUMEN_TECNICO.md).

---

## Requisitos

- Android 8 o superior (API 26+).
- La app **DiDi Conductor** instalada (`com.didiglobal.driver`).
- Activar el servicio de accesibilidad una sola vez.

## Instalación

1. Descarga `didi-copiloto.apk` desde **Actions → Android APK** o desde **Releases**.
2. En el teléfono, abre el APK y permite instalar desde esa fuente.
3. Abre **DIDI Copiloto**.
4. Pulsa **Activar accesibilidad** y enciende el interruptor de DIDI Copiloto.
5. En **Android 13 o superior**, si el interruptor aparece bloqueado:
   - Ajustes → Apps → DIDI Copiloto → menú ⋮ → **Permitir ajustes restringidos**.
   - Vuelve a Accesibilidad y actívalo.
6. Opcional: **Quitar restricción de batería** para que el sistema no cierre el servicio.
7. Opcional: **Activar acceso a notificaciones** para capturar también el texto de los avisos.

## Uso

1. Abre DiDi Conductor y ponte en línea.
2. Cuando llegue una oferta, aparece una **notificación heads-up** con:
   - 🔴 / 🟡 / 🟢
   - `$1.237/km · $22.613/h`
   - Recogida, viaje, precio y el motivo.
3. Si aceptas en DiDi, pulsa **Registrar** para abrir DIDI Pro con los datos ya cargados.
4. Si no te convence, pulsa **Ignorar**.

La notificación se actualiza con cada oferta nueva (no se acumulan), se descarta a los 60 segundos y no depende de que DiDi permita dibujar encima. En **Ajustes** puedes activar además la tarjeta flotante experimental.

## Ofertas “Pon tu precio” en lista

Cuando DiDi muestra la lista **Centro de solicitudes** con ofertas “Pon tu precio” que **no saltan**, el copiloto:

- **No envía notificación** (para no confundirlas con una oferta activa).
- Guarda **cada oferta por separado** (máximo 50, sin duplicados): no mezcla dos tarjetas de la lista.
- **Solo muestra ofertas con los datos completos** (precio y los dos tramos). Si una tarjeta aún no se ve completa, no aparece; se guarda cuando vuelve a capturarse con todos los datos.
- La **imagen es un recorte de esa tarjeta**, no la pantalla completa.
- La muestra en **MainActivity → Ofertas Pon tu precio (N)** como tarjeta individual con:
  - Fecha y hora.
  - Precio.
  - **Semáforo y análisis**: COP/km, COP/h y frase explicativa.
  - Recogida y viaje (min · km).
  - Miniatura recortada de la oferta.
  - Botones **Ver** (imagen ampliada), **Registrar** (abre DIDI Pro con los datos de esa oferta ya cargados) y **Borrar**.

Las ofertas “Pon tu precio” que **sí saltan** como popup siguen generando notificación normal.

## Rendimiento y precisión

- Muestreo de pantalla cada **1,5 s** mientras DiDi está en primer plano.
- El recorte y guardado de cada tarjeta se hace **en segundo plano**, sin frenar la siguiente captura.
- Si el OCR no lee el botón `Aceptar`, la tarjeta se agrupa por **precio + tramos** (respaldo).
- Dos viajes distintos con el mismo precio se guardan por separado: se comparan **km y minutos**.
- Detección tolerante a errores OCR en `Centro de solicitudes` y `Pon tu precio`.
- Diagnóstico de tiempos: `ocr_ms` y `ms` de cada captura.

## Ajustes

- Meta COP/hora (por defecto `$30.000`).
- Meta COP/km (por defecto `$2.000`).
- Precio del galón (`$16.000`) y rendimiento (`40 km/gal`).
- **“El tiempo del viaje ya incluye la recogida”**: actívalo si el segundo dato de DiDi (por ejemplo `35 min`) ya cuenta los minutos de recogida. Si no, se suman los dos tramos.
- **Notificación por oferta**: activada por defecto.
- **Tarjeta flotante sobre DiDi**: desactivada por defecto; algunos teléfonos o versiones de DiDi la bloquean.

Si no ves las notificaciones, revisa Ajustes → Apps → DIDI Copiloto → **Notificaciones**: el canal **Ofertas de DiDi** debe estar en importancia alta/urgente y permitir avisos flotantes.

## Probar sin una oferta real

En la pantalla principal pulsa **Probar con oferta de ejemplo**. Se abre una tarjeta con los mismos textos de una oferta real (`$16.206`, `8 min (1,9 km)`, `35 min (11,2 km)`) y debe aparecer la **notificación** con el análisis. El overlay solo aparece si lo activas en Ajustes.

## Realme / OPPO (Realme UI)

Además de **Quitar restricción de batería**:

1. Ajustes → Batería → **Consumo de batería de apps** → DIDI Copiloto → **Permitir actividad en segundo plano**.
2. Ajustes → Apps → DIDI Copiloto → **Inicio automático** → permitir.
3. En **Recientes**, desliza DIDI Copiloto hacia abajo y pulsa el **candado** para fijarla.
4. La **Función rápida** de accesibilidad **no hace falta**; puedes dejarla desactivada.

## Diagnóstico

Cada oferta leída se guarda en `filesDir/diagnostico.jsonl` (solo en el teléfono). El botón **Compartir diagnóstico** abre el menú de compartir para enviar el archivo. Sirve para calibrar el parser cuando DiDi cambie el formato.

El log incluye los textos crudos, los campos parseados y el resultado del motor. También registra `servicio_conectado`, `servicio_desconectado`, `didi_ventana`, `ocr_propio` (notificación propia ignorada), `lista_sin_notificar`, `captura_pon_tu_precio` con `ms` de procesamiento, `ocr_ms` y errores de captura. No se envía nada automáticamente.

## Compilar

```bash
# Requiere JDK 17 y Android SDK 35
cd android
./gradlew :app:testDebugUnitTest
./gradlew :app:assembleRelease
# APK firmado: app/build/outputs/apk/release/app-release.apk
```

En GitHub Actions, el workflow `.github/workflows/android.yml` ejecuta los tests y publica el APK como artifact. Al empujar un tag `android-v*` se crea un Release con el APK.

**Firma:** el APK se firma con `app/didi-sideload.keystore`, una clave estable guardada en el repo **solo para sideload** (no sirve para Play Store). Así las actualizaciones se instalan encima sin desinstalar. No cambies ese keystore: si se pierde, las versiones futuras no podrán actualizar la app instalada.

> La primera versión pública (`android-v0.1.0`) se firmó con una clave de debug temporal. Si la instalaste, desinstálala antes de instalar la versión con clave estable.

## Privacidad

- Sin backend, sin cuentas, sin analytics.
- La app no se conecta a DiDi ni modifica su APK.
- Solo lee los textos que DiDi ya muestra en pantalla y los guarda localmente.
- El botón Registrar abre la PWA con los datos en la URL; esa URL no se conserva en el historial (la PWA la limpia al cargar).

## Limitaciones

- Mientras DiDi está en primer plano, el copiloto muestrea la pantalla cada 1,5 segundos para no perder ofertas que no generan eventos de accesibilidad. El recorte y guardado de cada tarjeta se hace en segundo plano para no frenar la siguiente captura.
- Si el OCR no alcanza a leer el botón `Aceptar` de una tarjeta, se agrupa igual por precio y tramos (respaldo) para no perderla.
- Dos viajes distintos con el mismo precio se guardan por separado; se comparan también kilómetros y minutos.
- Si DiDi cambia el diseño de la oferta, hay que ajustar el parser (el log de diagnóstico lo hace rápido).
- Algunos fabricantes (Xiaomi, Huawei, Samsung) matan servicios en segundo plano; hay que excluir la app de la optimización de batería.
- No funciona en iPhone: iOS no permite leer la pantalla de otras apps.
- Las condiciones de uso de DiDi pueden restringir herramientas de asistencia. La decisión y el riesgo son del conductor.
