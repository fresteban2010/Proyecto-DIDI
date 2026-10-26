package com.fresteban.didicopiloto.offer

import android.accessibilityservice.AccessibilityService
import android.graphics.Rect
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
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

    private val escuchaNotificaciones: (List<String>) -> Unit = { textos ->
        evaluar(textos, origen = "notificacion")
    }

    override fun onServiceConnected() {
        super.onServiceConnected()
        conectado = true
        overlay?.hide()
        overlay = OfferOverlay(this)
        OfferBus.subscribe(escuchaNotificaciones)
    }

    override fun onDestroy() {
        conectado = false
        OfferBus.unsubscribe(escuchaNotificaciones)
        evaluacionPendiente?.let { handler.removeCallbacks(it) }
        overlay?.hide()
        overlay = null
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

        val root = rootInActiveWindow ?: return
        if (root.packageName?.toString() != paquete) return

        val nodos = mutableListOf<Pair<Int, String>>()
        recolectar(root, nodos)
        if (nodos.isEmpty()) return

        val textos = nodos.sortedBy { it.first }.map { it.second }

        if (!OfferDetector.pareceOferta(textos)) {
            if (event.eventType == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) {
                overlay?.hide()
            }
            return
        }

        evaluacionPendiente?.let { handler.removeCallbacks(it) }
        val tarea = Runnable { evaluar(textos, origen = "pantalla") }
        evaluacionPendiente = tarea
        handler.postDelayed(tarea, 200)
    }

    private fun recolectar(
        nodo: AccessibilityNodeInfo?,
        salida: MutableList<Pair<Int, String>>
    ) {
        if (nodo == null) return

        if (nodo.isVisibleToUser) {
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
            recolectar(nodo.getChild(i), salida)
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
