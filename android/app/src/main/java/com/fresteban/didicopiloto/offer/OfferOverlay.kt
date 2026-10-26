package com.fresteban.didicopiloto.offer

import android.accessibilityservice.AccessibilityService
import android.content.Context
import android.graphics.PixelFormat
import android.os.Handler
import android.os.Looper
import android.view.Gravity
import android.view.LayoutInflater
import android.view.View
import android.view.WindowManager
import android.widget.Button
import android.widget.FrameLayout
import android.widget.TextView
import com.fresteban.didicopiloto.R
import java.util.Locale

/**
 * Tarjeta flotante sobre DiDi. Vive en la franja superior para no tapar "Aceptar".
 */
class OfferOverlay(private val service: AccessibilityService) {

    private val windowManager =
        service.getSystemService(Context.WINDOW_SERVICE) as WindowManager
    private val handler = Handler(Looper.getMainLooper())
    private var view: View? = null

    private val ocultar = Runnable { hide() }

    fun show(offer: Offer, decision: Decision, onRegister: () -> Unit) {
        hide()

        val card = LayoutInflater.from(service)
            .inflate(R.layout.overlay_offer, FrameLayout(service), false)
        card.contentDescription =
            "Oferta de ${offer.precioCOP} pesos, recogida de ${offer.kmRecogida} kilómetros"
        val tvSemaforo = card.findViewById<TextView>(R.id.tvSemaforo)
        val tvMetricas = card.findViewById<TextView>(R.id.tvMetricas)
        val tvFrase = card.findViewById<TextView>(R.id.tvFrase)
        val btnRegistrar = card.findViewById<Button>(R.id.btnRegistrar)
        val btnIgnorar = card.findViewById<Button>(R.id.btnIgnorar)
        val btnCerrar = card.findViewById<TextView>(R.id.btnCerrar)

        when (decision.semaforo) {
            Semaforo.VERDE -> {
                tvSemaforo.text = "🟢 CONVIENE"
                tvSemaforo.setTextColor(service.getColor(R.color.green))
            }
            Semaforo.AMARILLO -> {
                tvSemaforo.text = "🟡 ACEPTABLE"
                tvSemaforo.setTextColor(service.getColor(R.color.yellow))
            }
            Semaforo.ROJO -> {
                tvSemaforo.text = "🔴 NO CONVIENE"
                tvSemaforo.setTextColor(service.getColor(R.color.red))
            }
        }

        tvMetricas.text = "${cop(decision.copKm.toLong())}/km · ${cop(decision.copHora.toLong())}/h"
        tvFrase.text = decision.frase

        btnRegistrar.setOnClickListener {
            hide()
            onRegister()
        }
        btnIgnorar.setOnClickListener { hide() }
        btnCerrar.setOnClickListener { hide() }

        val ancho = service.resources.displayMetrics.widthPixels - dp(16)
        val params = WindowManager.LayoutParams(
            ancho,
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.TOP or Gravity.START
            x = dp(8)
            y = dp(72)
        }

        runCatching {
            windowManager.addView(card, params)
            view = card
            handler.postDelayed(ocultar, 12_000)
        }.onFailure { error ->
            com.fresteban.didicopiloto.diag.DiagnosticLog.append(
                service,
                "overlay_error",
                listOf(error.javaClass.simpleName, error.message ?: "sin mensaje")
            )
        }
    }

    fun hide() {
        handler.removeCallbacks(ocultar)
        view?.let { runCatching { windowManager.removeView(it) } }
        view = null
    }

    fun estaVisible(): Boolean = view != null

    private fun dp(valor: Int): Int =
        (valor * service.resources.displayMetrics.density).toInt()

    private fun cop(valor: Long): String =
        "$" + String.format(Locale.US, "%,d", valor).replace(',', '.')
}
