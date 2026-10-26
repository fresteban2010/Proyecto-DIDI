package com.fresteban.didicopiloto.offer

import java.util.Locale

/**
 * Convierte los textos que expone la pantalla de DiDi en una [Offer].
 *
 * Reglas:
 *  - El precio es el monto mayor de la tarjeta (el total), no las líneas del desglose.
 *  - Los tramos aparecen como "8 min (1,9 km)": primero recogida, después viaje.
 *  - Formatos es-CO: punto para miles, coma para decimales.
 */
object OfferParser {

    private val PRECIO_REGEX = Regex("""\$\s*([\d.]+)""")
    private val TRAMO_REGEX = Regex("""(\d+)\s*min\s*\(\s*([\d.,]+)\s*km\s*\)""", RegexOption.IGNORE_CASE)
    private val PRECIO_PARTIDO_REGEX = Regex("""(\d)\.\s+(\d{3})""")

    private val PRECIO_MIN = 1_000L
    private val PRECIO_MAX = 200_000L
    private val KM_MAX = 100.0
    private val MIN_MAX = 180

    fun parse(textos: List<String>): Offer? {
        if (textos.isEmpty()) return null

        val crudo = textos.joinToString(" ").replace(PRECIO_PARTIDO_REGEX) {
            "${it.groupValues[1]}.${it.groupValues[2]}"
        }

        val precio = PRECIO_REGEX.findAll(crudo)
            .mapNotNull { it.groupValues[1].replace(".", "").toLongOrNull() }
            .maxOrNull()
            ?: return null

        if (precio !in PRECIO_MIN..PRECIO_MAX) return null

        val tramos = TRAMO_REGEX.findAll(crudo).mapNotNull { match ->
            val minutos = match.groupValues[1].toIntOrNull()
            val km = match.groupValues[2].replace(",", ".").toDoubleOrNull()
            if (minutos == null || km == null) null else minutos to km
        }.toList()

        if (tramos.size < 2) return null

        val (minRecogida, kmRecogida) = tramos[0]
        val (minViaje, kmViaje) = tramos[1]

        if (kmRecogida < 0.0 || kmRecogida > KM_MAX) return null
        if (kmViaje <= 0.0 || kmViaje > KM_MAX) return null
        if (minRecogida < 0 || minRecogida > MIN_MAX) return null
        if (minViaje <= 0 || minViaje > MIN_MAX) return null

        val metodo = if (crudo.contains("tarjeta", ignoreCase = true)) "tarjeta" else "efectivo"

        return Offer(
            precioCOP = precio,
            kmRecogida = kmRecogida,
            minRecogida = minRecogida,
            kmViaje = kmViaje,
            minViaje = minViaje,
            metodoPago = metodo,
            crudo = crudo
        )
    }

    fun formatearKm(km: Double): String =
        String.format(Locale.US, "%.1f", km).replace('.', ',')
}
