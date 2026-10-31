package com.fresteban.didicopiloto.pon_tu_precio

/**
 * Separa una captura de "Centro de solicitudes" en ofertas individuales.
 * Cada tarjeta termina en "Aceptar"; dentro de ella se toma el precio mayor
 * (el total) y sus dos tramos (recogida y viaje).
 */
data class OfertaLista(
    val precio: Long,
    val minRecogida: Int?,
    val kmRecogida: Double?,
    val minViaje: Int?,
    val kmViaje: Double?,
    val esPonTuPrecio: Boolean,
    val texto: String
) {
    val completa: Boolean
        get() = minRecogida != null && kmRecogida != null &&
            minViaje != null && kmViaje != null
}

object PonTuPrecioParser {

    private val PRECIO = Regex("""\$\s*(\d{1,3}(?:[.,]\d{3})+|\d+)""")
    private val TRAMO = Regex(
        """\(?\s*(\d+)\s*min\s*[\(,]?\s*([\d.,]+)\s*(km|m)\s*\)?""",
        RegexOption.IGNORE_CASE
    )

    fun ofertas(textos: List<String>): List<OfertaLista> {
        if (textos.isEmpty()) return emptyList()

        // Cada tarjeta de la lista termina en su botón "Aceptar".
        val segmentos = mutableListOf<List<String>>()
        var actual = mutableListOf<String>()
        for (linea in textos) {
            actual.add(linea)
            if (linea.contains("aceptar", ignoreCase = true)) {
                segmentos.add(actual.toList())
                actual = mutableListOf()
            }
        }
        if (actual.isNotEmpty()) segmentos.add(actual.toList())

        return segmentos.mapNotNull tarjeta@ { segmento ->
            val unido = segmento.joinToString(" ")
            val esPon = unido.contains("pon tu precio", ignoreCase = true)

            val precio = PRECIO.findAll(unido).mapNotNull { match ->
                match.groupValues[1]
                    .replace(".", "")
                    .replace(",", "")
                    .toLongOrNull()
            }.filter { it in 1_000..200_000 }.maxOrNull() ?: return@tarjeta null

            val tramos = segmento.flatMap { linea ->
                TRAMO.findAll(linea).mapNotNull tramo@ { match ->
                    val minutos = match.groupValues[1].toIntOrNull()
                        ?: return@tramo null
                    val valor = match.groupValues[2].replace(",", ".").toDoubleOrNull()
                        ?: return@tramo null
                    val km = if (match.groupValues[3].lowercase() == "m") {
                        valor / 1_000.0
                    } else {
                        valor
                    }
                    if (km <= 0.0 || km > 100.0) null else minutos to km
                }
            }.take(2)

            OfertaLista(
                precio = precio,
                minRecogida = tramos.getOrNull(0)?.first,
                kmRecogida = tramos.getOrNull(0)?.second,
                minViaje = tramos.getOrNull(1)?.first,
                kmViaje = tramos.getOrNull(1)?.second,
                esPonTuPrecio = esPon,
                texto = unido.take(500)
            )
        }
    }
}
