package com.fresteban.didicopiloto.bridge

import android.content.Context
import android.content.Intent
import android.net.Uri
import com.fresteban.didicopiloto.BuildConfig
import com.fresteban.didicopiloto.offer.Offer
import java.util.Locale

object PwaBridge {

    fun open(context: Context, offer: Offer) {
        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(buildUrl(offer))).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        runCatching { context.startActivity(intent) }
    }

    fun buildUrl(offer: Offer, baseUrl: String = BuildConfig.PWA_BASE_URL): String {
        val base = baseUrl.trimEnd('/')
        return buildString {
            append(base)
            append("/?registrar=1")
            append("&precio=").append(offer.precioCOP)
            append("&kmRecogida=").append(numero(offer.kmRecogida))
            append("&minRecogida=").append(offer.minRecogida)
            append("&kmViaje=").append(numero(offer.kmViaje))
            append("&minViaje=").append(offer.minViaje)
            append("&metodo=").append(offer.metodoPago)
        }
    }

    private fun numero(valor: Double): String {
        val texto = String.format(Locale.US, "%.2f", valor)
        return texto.trimEnd('0').trimEnd('.')
    }
}
