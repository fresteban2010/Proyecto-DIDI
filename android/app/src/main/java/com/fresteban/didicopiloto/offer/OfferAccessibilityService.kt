package com.fresteban.didicopiloto.offer

import android.accessibilityservice.AccessibilityService
import android.graphics.Bitmap
import android.graphics.Rect
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.view.Display
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import android.view.accessibility.AccessibilityWindowInfo
import androidx.core.content.ContextCompat
import com.fresteban.didicopiloto.bridge.PwaBridge
import com.fresteban.didicopiloto.data.SettingsRepository
import com.fresteban.didicopiloto.data.SharedPrefsStore
import com.fresteban.didicopiloto.diag.DiagnosticLog

class OfferAccessibilityService : AccessibilityService() {

    companion object {
        const val DIDI_PACKAGE = "com.didiglobal.driver"

        @Volatile
        var conectado: Boolean = false
            private set
    }

    private val handler = Handler(Looper.getMainLooper())
    private var overlay: OfferOverlay? = null
    private var evaluacionPendiente: Runnable? = null
    private var ultimoHash: String = ""
    private var ultimoHashAt: Long = 0L
    private var ultimoEventoAt: Long = 0L
    private var ultimoDiagAt: Long = 0L
    private var ocr: OfferOcr? = null
    private var capturando: Boolean = false
    private var ultimaCapturaAt: Long = 0L

    private val escuchaNotificaciones: (List<String>) -> Unit = { textos ->
        evaluar(textos, origen = "notificacion")
    }

    override fun onServiceConnected() {
        super.onServiceConnected()
        conectado = true
        overlay?.hide()
        overlay = OfferOverlay(this)
        OfferBus.subscribe(escuchaNotificaciones)
        DiagnosticLog.append(this, "servicio_conectado", listOf("accesibilidad conectada"))
    }

    override fun onDestroy() {
        conectado = false
        DiagnosticLog.append(this, "servicio_desconectado", listOf("accesibilidad destruida"))
        OfferBus.unsubscribe(escuchaNotificaciones)
        evaluacionPendiente?.let { handler.removeCallbacks(it) }
        overlay?.hide()
        overlay = null
        ocr?.cerrar()
        ocr = null
        capturando = false
        super.onDestroy()
    }

    override fun onInterrupt() {
        overlay?.hide()
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (event == null) return

        val paquete = event.packageName?.toString() ?: return
        val clase = event.className?.toString() ?: ""

        // Ahora recibimos eventos de todas las apps para poder ocultar la tarjeta
        // al salir de DiDi. El filtro real se hace aquí, antes de recorrer el árbol.
        if (paquete != DIDI_PACKAGE && paquete != packageName) {
            overlay?.hide()
            return
        }
        if (paquete == packageName && !clase.contains("MockOfferActivity")) return

        val ahora = SystemClock.uptimeMillis()
        if (ahora - ultimoEventoAt < 150) return
        ultimoEventoAt = ahora

        val textos = mutableListOf<String>()
        val ventanas = mutableListOf<String>()

        // 1. Texto que trae el propio evento (a veces existe aunque el árbol esté vacío).
        event.text?.forEach { valor ->
            valor?.toString()?.takeIf { it.isNotBlank() }?.let { textos.add(it) }
        }
        event.contentDescription?.toString()?.takeIf { it.isNotBlank() }?.let { textos.add(it) }

        // 2. Árbol de la ventana activa, incluyendo nodos marcados como invisibles.
        val root = rootInActiveWindow
        if (root != null && root.packageName?.toString() == paquete) {
            val nodos = mutableListOf<Pair<Int, String>>()
            recolectar(root, nodos, incluirInvisibles = true)
            textos.addAll(nodos.sortedBy { it.first }.map { it.second })
            ventanas.add("activa=${root.className}:${nodos.size}")
        }

        // 3. Todas las ventanas interactivas de DiDi (diálogos y overlays incluidos).
        if (paquete == DIDI_PACKAGE) {
            runCatching {
                windows?.forEach { ventana: AccessibilityWindowInfo ->
                    val raiz = ventana.root ?: return@forEach
                    if (raiz.packageName?.toString() != DIDI_PACKAGE) return@forEach
                    val nodos = mutableListOf<Pair<Int, String>>()
                    recolectar(raiz, nodos, incluirInvisibles = true)
                    ventanas.add("win=${ventana.type}:${raiz.className}:${nodos.size}")
                    textos.addAll(nodos.sortedBy { it.first }.map { it.second })
                }
            }
        }

        val unicos = textos.distinct()

        if (paquete == DIDI_PACKAGE) {
            diagnosticarVentana(
                unicos,
                clase,
                event.eventType,
                ventanas = ventanas
            )
            // DiDi no expone la oferta como nodos: se lee por OCR.
            intentarOcr(event.eventType)
        }

        if (!OfferDetector.pareceOferta(unicos)) {
            if (event.eventType == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) {
                overlay?.hide()
            }
            return
        }

        evaluacionPendiente?.let { handler.removeCallbacks(it) }
        val tarea = Runnable { evaluar(unicos, origen = "pantalla") }
        evaluacionPendiente = tarea
        handler.postDelayed(tarea, 200)
    }

    /**
     * Guarda una foto de la ventana de DiDi para saber si el servicio la ve y
     * qué textos expone. Es temporal: sirve para calibrar el parser.
     */
    private fun diagnosticarVentana(
        textos: List<String>,
        clase: String,
        tipo: Int,
        ventanas: List<String>
    ) {
        val ahora = SystemClock.uptimeMillis()
        if (ahora - ultimoDiagAt < 1_000) return
        ultimoDiagAt = ahora

        val cabecera = listOf(
            "clase=$clase",
            "tipo=$tipo",
            "nodos=${textos.size}",
            "ventanas=${ventanas.joinToString(",")}"
        )
        DiagnosticLog.append(this, "didi_ventana", cabecera + textos.take(150))
    }

    private fun recolectar(
        nodo: AccessibilityNodeInfo?,
        salida: MutableList<Pair<Int, String>>,
        incluirInvisibles: Boolean = false
    ) {
        if (nodo == null) return

        if (incluirInvisibles || nodo.isVisibleToUser) {
            val texto = listOfNotNull(
                nodo.text?.toString()?.trim()?.takeIf { it.isNotEmpty() },
                nodo.contentDescription?.toString()?.trim()?.takeIf { it.isNotEmpty() }
            ).distinct().joinToString(" ")

            if (texto.isNotEmpty()) {
                val rect = Rect()
                nodo.getBoundsInScreen(rect)
                salida.add(rect.top to texto)
            }
        }

        for (i in 0 until nodo.childCount) {
            recolectar(nodo.getChild(i), salida, incluirInvisibles)
        }
    }

    /**
     * Plan B: cuando DiDi no expone la oferta en accesibilidad, se toma una
     * captura de pantalla y se pasa por OCR on-device.
     */
    private fun intentarOcr(tipoEvento: Int) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) return
        // No capturar nuestra propia app ni una pantalla que ya no es DiDi.
        if (rootInActiveWindow?.packageName?.toString() != DIDI_PACKAGE) return
        if (tipoEvento != AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED &&
            tipoEvento != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED
        ) {
            return
        }
        if (capturando || overlay?.estaVisible() == true) return

        val ahora = SystemClock.uptimeMillis()
        if (ahora - ultimaCapturaAt < 1_500) return
        ultimaCapturaAt = ahora
        capturando = true

        val cliente = ocr ?: OfferOcr().also { ocr = it }

        runCatching {
            takeScreenshot(
                Display.DEFAULT_DISPLAY,
                ContextCompat.getMainExecutor(this),
                object : AccessibilityService.TakeScreenshotCallback {
                    override fun onSuccess(screenshot: AccessibilityService.ScreenshotResult) {
                        runCatching {
                            val buffer = screenshot.hardwareBuffer
                            try {
                                val bitmap = Bitmap.wrapHardwareBuffer(buffer, screenshot.colorSpace)
                                val copia = bitmap?.copy(Bitmap.Config.ARGB_8888, false)

                                if (copia == null) {
                                    capturando = false
                                    DiagnosticLog.append(
                                        this@OfferAccessibilityService,
                                        "ocr_error",
                                        listOf("bitmap null")
                                    )
                                    return
                                }

                                cliente.reconocer(
                                    copia,
                                    { lineas ->
                                        copia.recycle()
                                        capturando = false
                                        if (lineas.isNotEmpty()) {
                                            DiagnosticLog.append(
                                                this@OfferAccessibilityService,
                                                "ocr_textos",
                                                lineas
                                            )
                                            evaluar(lineas, origen = "ocr")
                                        }
                                    },
                                    { error ->
                                        copia.recycle()
                                        capturando = false
                                        DiagnosticLog.append(
                                            this@OfferAccessibilityService,
                                            "ocr_error",
                                            listOf(error.javaClass.simpleName, error.message ?: "")
                                        )
                                    }
                                )
                            } finally {
                                buffer.close()
                            }
                        }.onFailure { error ->
                            capturando = false
                            DiagnosticLog.append(
                                this@OfferAccessibilityService,
                                "ocr_error",
                                listOf(error.javaClass.simpleName, error.message ?: "")
                            )
                        }
                    }

                    override fun onFailure(errorCode: Int) {
                        capturando = false
                        DiagnosticLog.append(
                            this@OfferAccessibilityService,
                            "ocr_fallo",
                            listOf("codigo=$errorCode")
                        )
                    }
                }
            )
        }.onFailure { error ->
            capturando = false
            DiagnosticLog.append(
                this,
                "ocr_error",
                listOf(error.javaClass.simpleName, error.message ?: "")
            )
        }
    }

    private fun evaluar(textos: List<String>, origen: String) {
        // Una notificación vieja no debe pintar una tarjeta si DiDi no está abierto.
        if (origen == "notificacion") {
            val enPantalla = rootInActiveWindow?.packageName?.toString()
            if (enPantalla != null && enPantalla != DIDI_PACKAGE) return
        }

        val config = SettingsRepository(SharedPrefsStore(this)).load()
        val offer = OfferParser.parse(textos)

        if (offer == null) {
            DiagnosticLog.append(this, "sin_parsear:$origen", textos)
            return
        }

        val hash = "${offer.precioCOP}|${offer.kmRecogida}|${offer.minRecogida}|${offer.kmViaje}|${offer.minViaje}"
        val ahora = System.currentTimeMillis()
        if (hash == ultimoHash && ahora - ultimoHashAt < 30_000) return
        ultimoHash = hash
        ultimoHashAt = ahora

        val decision = DecisionEngine.evaluar(offer, config)
        DiagnosticLog.append(this, "oferta:$origen", textos, offer, decision)

        overlay?.show(offer, decision) {
            PwaBridge.open(this, offer, config.viajeIncluyeRecogida)
        }
    }
}
