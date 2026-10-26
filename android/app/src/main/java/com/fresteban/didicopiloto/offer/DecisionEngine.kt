package com.fresteban.didicopiloto.offer

import com.fresteban.didicopiloto.data.MetaConfig
import java.util.Locale

enum class Semaforo { VERDE, AMARILLO, ROJO }

data class Decision(
    val kmTotal: Double,
    val minTotal: Int,
    val copKm: Double,
    val copHora: Double,
    val gasolinaCOP: Long,
    val netoCOP: Long,
    val semaforo: Semaforo,
    val frase: String
)

object DecisionEngine {

    fun evaluar(offer: Offer, config: MetaConfig): Decision {
        val cfg = if (config.esValida()) config else MetaConfig()

        val kmTotal = offer.kmRecogida + offer.kmViaje
        val minTotal = if (cfg.viajeIncluyeRecogida) {
            offer.minViaje
        } else {
            offer.minRecogida + offer.minViaje
        }

        val copKm = if (kmTotal > 0.0) offer.precioCOP / kmTotal else 0.0
        val copHora = if (minTotal > 0) offer.precioCOP * 60.0 / minTotal else 0.0

        val costoKm = cfg.precioGalonCOP / cfg.rendimientoKmGalon
        val gasolina = (kmTotal * costoKm).toLong()
        val neto = offer.precioCOP - gasolina

        val semaforo = cuando(copHora, copKm, cfg)
        val frase = frase(offer, kmTotal, minTotal, copKm, copHora, semaforo, cfg)

        return Decision(
            kmTotal = kmTotal,
            minTotal = minTotal,
            copKm = copKm,
            copHora = copHora,
            gasolinaCOP = gasolina,
            netoCOP = neto,
            semaforo = semaforo,
            frase = frase
        )
    }

    private fun cuando(copHora: Double, copKm: Double, config: MetaConfig): Semaforo {
        val cumpleHora = copHora >= config.metaCopHora
        val cumpleKm = copKm >= config.metaCopKm
        return when {
            cumpleHora && cumpleKm -> Semaforo.VERDE
            cumpleHora || cumpleKm -> Semaforo.AMARILLO
            copHora >= config.metaCopHora * 0.8 && copKm >= config.metaCopKm * 0.8 -> Semaforo.AMARILLO
            else -> Semaforo.ROJO
        }
    }

    private fun frase(
        offer: Offer,
        kmTotal: Double,
        minTotal: Int,
        copKm: Double,
        copHora: Double,
        semaforo: Semaforo,
        config: MetaConfig
    ): String {
        val km = OfferParser.formatearKm(kmTotal)
        val recogida = OfferParser.formatearKm(offer.kmRecogida)

        return when (semaforo) {
            Semaforo.VERDE -> "Vale la pena: ${cop(copKm.toLong())}/km y ${cop(copHora.toLong())}/h."

            Semaforo.AMARILLO -> when {
                copKm >= config.metaCopKm ->
                    "Aceptable: cumple $/km, pero la hora va en ${cop(copHora.toLong())}."
                copHora >= config.metaCopHora ->
                    "Aceptable: cumple $/h, pero el km va en ${cop(copKm.toLong())}."
                else ->
                    "Aceptable: cerca de tus metas (${cop(copKm.toLong())}/km y ${cop(copHora.toLong())}/h)."
            }

            Semaforo.ROJO -> {
                val base = "No conviene: $km km y $minTotal min para ${cop(offer.precioCOP)} → " +
                    "${cop(copKm.toLong())}/km y ${cop(copHora.toLong())}/h."
                if (offer.kmRecogida >= 3.0) {
                    "$base La recogida de $recogida km te come la ganancia."
                } else {
                    base
                }
            }
        }
    }

    private fun cop(valor: Long): String =
        "$" + String.format(Locale.US, "%,d", valor).replace(',', '.')
}
