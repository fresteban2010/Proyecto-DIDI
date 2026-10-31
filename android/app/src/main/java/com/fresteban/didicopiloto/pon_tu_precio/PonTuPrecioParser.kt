package com.fresteban.didicopiloto.pon_tu_precio

import java.util.Locale

/** Extrae precios y tramos legibles de una captura OCR de "Centro de solicitudes". */
object PonTuPrecioParser {

    private val PRECIO_REGEX = Regex("""\$\s*(\d{1,3}(?:[.,]\d{3})+|\d+)""")
    private val TRAMO_REGEX = Regex(
        """\(?\s*(\d+)\s*min\s*[, ]\s*([\d.,]+)\s*(km|m)\s*\)?""",
        RegexOption.IGNORE_CASE
    )

    fun precios(textos: List<String>): List<Long> {
        val unido = textos.joinToString(" | ")
        return PRECIO_REGEX.findAll(unido).mapNotNull { match ->
            match.groupValues[1]
                .replace(".", "")
                .replace(",", "")
                .toLongOrNull()
        }.filter { it in 1_000..200_000 }.distinct().take(6).toList()
    }

    fun tramos(textos: List<String>): List<String> {
        val unido = textos.joinToString(" | ")
        return TRAMO_REGEX.findAll(unido).mapNotNull { match ->
            val minutos = match.groupValues[1].toIntOrNull() ?: return@mapNotNull null
            val valor = match.groupValues[2].replace(",", ".").toDoubleOrNull()
                ?: return@mapNotNull null
            val km = if (match.groupValues[3].lowercase() == "m") valor / 1_000.0 else valor
            if (km <= 0.0 || km > 100.0) {
                null
            } else {
                "$minutos min · " +
                    String.format(Locale.US, "%.1f", km).replace('.', ',') + " km"
            }
        }.distinct().take(4).toList()
    }
}
