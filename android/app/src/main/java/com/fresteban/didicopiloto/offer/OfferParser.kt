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

    // Solo dígitos con separadores de miles: evita pegar el multiplicador
    // del OCR ("$17.7941,5x" debe leerse como $17.794 y 1,5x).
    private val PRECIO_REGEX = Regex("""\$\s*(\d{1,3}(?:[.,]\d{3})+|\d+)""")
    // El OCR confunde 0 con O dentro de montos ("$1709O" → "$17090").
    private val OCR_O = Regex("""(?<=\d)[Oo](?=\d|[.,:;xX])""")
    private val TRAMO_REGEX = Regex(
        """(\d+)\s*min\s*\(\s*([\d.,]+)\s*(km|m)\s*\)""",
        RegexOption.IGNORE_CASE
    )
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
            val valor = match.groupValues[1]
                .replace(".", "")
                .replace(",", "")
                .toLongOrNull()
            if (valor == null) null else match.range.first to valor
        }.toList()

        val seleccionado = precioTotal(crudo, montos) ?: return null
        var precio = seleccionado.second

        // Los tramos de la oferta van después del precio. Así se ignora un ETA
        // del mapa que pueda aparecer más arriba en el árbol de accesibilidad.
        var tramos = tramosDesde(crudo, seleccionado.first + 1)

        if (tramos.size < 2) {
            // Algunos OCR dejan los botones de precio detrás de los tramos
            // (p. ej. "Pon tu precio"). Se reintenta con todos y se toma el
            // total que aparece antes del primer tramo.
            val todos = tramosDesde(crudo, 0)
            if (todos.size >= 2) {
                tramos = todos.takeLast(2)
                val primerTramo = tramos.first().third
                val antes = montos.filter { it.first < primerTramo }
                if (antes.isNotEmpty()) {
                    precio = antes.maxByOrNull { it.second }?.second ?: precio
                }
            }
        }

        if (precio !in PRECIO_MIN..PRECIO_MAX) return null
        if (tramos.size < 2) return null

        val (minRecogida, kmRecogida, _) = tramos[0]
        val (minViaje, kmViaje, _) = tramos[1]

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

    private fun tramosDesde(crudo: String, desde: Int): List<Triple<Int, Double, Int>> {
        val inicio = desde.coerceIn(0, crudo.length)
        return TRAMO_REGEX.findAll(crudo.substring(inicio)).mapNotNull { match ->
            val minutos = match.groupValues[1].toIntOrNull()
            val valor = match.groupValues[2].replace(",", ".").toDoubleOrNull()
            val unidad = match.groupValues[3].lowercase()
            val km = when {
                valor == null -> null
                unidad == "m" -> valor / 1_000.0
                else -> valor
            }
            if (minutos == null || km == null) null
            else Triple(minutos, km, inicio + match.range.first)
        }.toList()
    }

    private fun normalizar(textos: List<String>): String =
        textos.joinToString(" ")
            .replace(ESPACIOS_RAROS, " ")
            .replace(OCR_O, "0")
            .replace(ESPACIOS, " ")
            .trim()
            .replace(PRECIO_PARTIDO_REGEX) {
                "${it.groupValues[1]}.${it.groupValues[2]}"
            }

    private fun precioTotal(crudo: String, montos: List<Pair<Int, Long>>): Pair<Int, Long>? {
        val validos = montos.filter { it.second in PRECIO_MIN..PRECIO_MAX }
        if (validos.isEmpty()) return null

        val minuscula = crudo.lowercase()
        val etiquetas = listOf("total", "recibirás", "recibiras", "recibes", "ganancia")
        val posicionEtiqueta = etiquetas
            .map { minuscula.indexOf(it) }
            .filter { it >= 0 }
            .minOrNull()

        if (posicionEtiqueta != null) {
            val despues = validos.filter { it.first > posicionEtiqueta }
            if (despues.isNotEmpty()) {
                return despues.minByOrNull { it.first }
            }
        }

        return validos.maxByOrNull { it.second }
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
