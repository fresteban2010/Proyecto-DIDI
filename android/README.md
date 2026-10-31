# DIDI Copiloto (Android)

App nativa que lee la oferta de **DiDi Conductor**, calcula si la carrera conviene y **te avisa con una notificación** (semáforo, COP/km y COP/h). La tarjeta flotante sobre DiDi queda como opción experimental. **No acepta ni rechaza viajes**: solo aconseja.

Se instala por **sideload** (APK). No requiere Play Store, cuenta, servidor ni internet.

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
- Guarda una **captura de pantalla** de esa lista (máximo 50, sin duplicados).
- La muestra en **MainActivity → Ofertas Pon tu precio (N)** como tarjeta con:
  - Fecha y hora.
  - Precios detectados.
  - Tramos detectados (min · km).
  - Miniatura de la captura.
  - Botones **Ver** (captura completa), **Registrar** (abre DIDI Pro) y **Borrar**.

Las ofertas “Pon tu precio” que **sí saltan** como popup siguen generando notificación normal.

## Ajustes

- Meta COP/hora (por defecto `$30.000`).
- Meta COP/km (por defecto `$2.000`).
- Precio del galón (`$16.000`) y rendimiento (`40 km/gal`).
- **“El tiempo del viaje ya incluye la recogida”**: actívalo si el segundo dato de DiDi (por ejemplo `35 min`) ya cuenta los minutos de recogida. Si no, se suman los dos tramos.
- **Notificación por oferta**: activada por defecto.
- **Tarjeta flotante sobre DiDi**: desactivada por defecto; algunos teléfonos o versiones de DiDi la bloquean.

Si no ves las notificaciones, revisa Ajustes → Apps → DIDI Copiloto → **Notificaciones**: el canal **Ofertas de DiDi** debe estar en importancia alta/urgente y permitir avisos flotantes.

## Probar sin una oferta real

En la pantalla principal pulsa **Probar con oferta de ejemplo**. Se abre una tarjeta con los mismos textos de una oferta real (`$16.206`, `8 min (1,9 km)`, `35 min (11,2 km)`) y el overlay debe aparecer en la franja superior.

## Realme / OPPO (Realme UI)

Además de **Quitar restricción de batería**:

1. Ajustes → Batería → **Consumo de batería de apps** → DIDI Copiloto → **Permitir actividad en segundo plano**.
2. Ajustes → Apps → DIDI Copiloto → **Inicio automático** → permitir.
3. En **Recientes**, desliza DIDI Copiloto hacia abajo y pulsa el **candado** para fijarla.
4. La **Función rápida** de accesibilidad **no hace falta**; puedes dejarla desactivada.

## Diagnóstico

Cada oferta leída se guarda en `filesDir/diagnostico.jsonl` (solo en el teléfono). El botón **Compartir diagnóstico** abre el menú de compartir para enviar el archivo. Sirve para calibrar el parser cuando DiDi cambie el formato.

El log incluye los textos crudos, los campos parseados y el resultado del motor. También registra `servicio_conectado`, `servicio_desconectado`, `didi_ventana`, `ocr_propio` (notificación propia ignorada), `lista_sin_notificar`, `captura_pon_tu_precio` y errores de captura. No se envía nada automáticamente.

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

- Mientras DiDi está en primer plano, el copiloto muestrea la pantalla cada 2 segundos para no perder ofertas que no generan eventos de accesibilidad. Es el precio de la fiabilidad; si notas consumo de batería, se puede subir el intervalo.
- Si DiDi cambia el diseño de la oferta, hay que ajustar el parser (el log de diagnóstico lo hace rápido).
- Algunos fabricantes (Xiaomi, Huawei, Samsung) matan servicios en segundo plano; hay que excluir la app de la optimización de batería.
- No funciona en iPhone: iOS no permite leer la pantalla de otras apps.
- Las condiciones de uso de DiDi pueden restringir herramientas de asistencia. La decisión y el riesgo son del conductor.
