package com.fresteban.didicopiloto.offer

import java.util.Locale

/**
 * Convierte los textos que expone la pantalla de DiDi en una [Offer].
 *
 * Reglas:
 *  - Si hay una etiqueta "Total"/"Recibirás", se usa el monto que la sigue.
 *  - Si no, se usa el monto mayor de la tarjeta (el total frente al desglose).
 *  - Los tramos aparecen como "8 min (1,9 km)": primero recogida, después viaje.
 *  - Formatos es-CO: punto para miles, coma para decimales.
 */
object OfferParser {

    private val PRECIO_REGEX = Regex("""\$\s*([\d.]+)""")
    private val TRAMO_REGEX = Regex("""(\d+)\s*min\s*\(\s*([\d.,]+)\s*km\s*\)""", RegexOption.IGNORE_CASE)
    private val PRECIO_PARTIDO_REGEX = Regex("""(\d)\.\s+(\d{3})""")
    private val ESPACIOS_RAROS = Regex("""[\u00A0\u202F]""")
    private val ESPACIOS = Regex("""\s+""")

    private val PRECIO_MIN = 1_000L
    private val PRECIO_MAX = 200_000L
    private val KM_MAX = 100.0
    private val MIN_MAX = 180

    fun parse(textos: List<String>): Offer? {
        if (textos.isEmpty()) return null

        val crudo = normalizar(textos)

        val montos = PRECIO_REGEX.findAll(crudo).mapNotNull { match ->
            val valor = match.groupValues[1].replace(".", "").toLongOrNull()
            if (valor == null) null else match.range.first to valor
        }.toList()

        val seleccionado = precioTotal(crudo, montos) ?: return null
        val precio = seleccionado.second
        if (precio !in PRECIO_MIN..PRECIO_MAX) return null

        // Los tramos de la oferta van después del precio. Así se ignora un ETA
        // del mapa que pueda aparecer más arriba en el árbol de accesibilidad.
        val desde = (seleccionado.first + 1).coerceAtMost(crudo.length)
        val tramos = TRAMO_REGEX.findAll(crudo.substring(desde)).mapNotNull { match ->
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

        return Offer(
            precioCOP = precio,
            kmRecogida = kmRecogida,
            minRecogida = minRecogida,
            kmViaje = kmViaje,
            minViaje = minViaje,
            metodoPago = metodoPago(crudo),
            crudo = crudo
        )
    }

    fun formatearKm(km: Double): String =
        String.format(Locale.US, "%.1f", km).replace('.', ',')

    private fun normalizar(textos: List<String>): String =
        textos.joinToString(" ")
            .replace(ESPACIOS_RAROS, " ")
            .replace(ESPACIOS, " ")
            .trim()
            .replace(PRECIO_PARTIDO_REGEX) {
                "${it.groupValues[1]}.${it.groupValues[2]}"
            }

    private fun precioTotal(crudo: String, montos: List<Pair<Int, Long>>): Pair<Int, Long>? {
        if (montos.isEmpty()) return null

        val minuscula = crudo.lowercase()
        val etiquetas = listOf("total", "recibirás", "recibiras", "recibes", "ganancia")
        val posicionEtiqueta = etiquetas
            .map { minuscula.indexOf(it) }
            .filter { it >= 0 }
            .minOrNull()

        if (posicionEtiqueta != null) {
            val despues = montos.filter { it.first > posicionEtiqueta }
            if (despues.isNotEmpty()) {
                return despues.minByOrNull { it.first }
            }
        }

        return montos.maxByOrNull { it.second }
    }

    private fun metodoPago(crudo: String): String {
        val minuscula = crudo.lowercase()
        if (minuscula.contains("pagas con tarjeta") || minuscula.contains("pago con tarjeta")) {
            return "tarjeta"
        }
        if (minuscula.contains("pagas con efectivo") || minuscula.contains("pago con efectivo")) {
            return "efectivo"
        }
        val tarjeta = Regex("""\btarjeta\b""").findAll(minuscula).count()
        val efectivo = Regex("""\befectivo\b""").findAll(minuscula).count()
        return if (tarjeta > efectivo) "tarjeta" else "efectivo"
    }
}
