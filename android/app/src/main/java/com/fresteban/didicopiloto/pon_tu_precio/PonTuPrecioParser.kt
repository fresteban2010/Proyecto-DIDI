package com.fresteban.didicopiloto.pon_tu_precio

import com.fresteban.didicopiloto.offer.LineaOcr

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

/** Tarjeta dibujada en pantalla: su oferta y el rectángulo para recortarla. */
data class TarjetaLista(
    val oferta: OfertaLista,
    val top: Int,
    val bottom: Int,
    val left: Int,
    val right: Int
)

object PonTuPrecioParser {

    private val PRECIO = Regex("""\$\s*(\d{1,3}(?:[.,]\d{3})+|\d+)""")
    private val TRAMO = Regex(
        """\(?\s*(\d+)\s*min\s*[\(,]?\s*([\d.,]+)\s*(km|m)\s*\)?""",
        RegexOption.IGNORE_CASE
    )

    /**
     * Agrupa las líneas por tarjeta usando el botón "Aceptar" como cierre.
     * Devuelve cada tarjeta con su oferta y el rectángulo que ocupa.
     */
    fun tarjetas(lineas: List<LineaOcr>): List<TarjetaLista> {
        if (lineas.isEmpty()) return emptyList()

        val ordenadas = lineas.sortedWith(compareBy({ it.top }, { it.left }))
        val alturas = ordenadas.map { it.bottom - it.top }.filter { it > 0 }.sorted()
        val alturaMedia = if (alturas.isEmpty()) 40 else alturas[alturas.size / 2]

        val resultado = mutableListOf<TarjetaLista>()
        var anterior = 0

        ordenadas.filter { it.texto.contains("aceptar", ignoreCase = true) }
            .forEach { aceptar ->
                val rango = ordenadas.filter { it.top >= anterior && it.top <= aceptar.bottom }
                val precio = rango.firstOrNull { esPrecio(it) }

                if (precio != null) {
                    // Sube desde el precio hasta la línea del título, sin entrar al
                    // encabezado de la lista ni saltar a otra tarjeta.
                    var top = precio.top
                    var indice = rango.indexOf(precio) - 1
                    while (indice >= 0) {
                        val linea = rango[indice]
                        if (top - linea.bottom > alturaMedia * 1.5) break
                        if (esEncabezado(linea.texto)) break
                        top = linea.top
                        indice--
                    }

                    val contenido = rango.filter { it.top >= top && it.top <= aceptar.bottom }
                    if (contenido.isNotEmpty()) {
                        val oferta = ofertas(contenido.map { it.texto }).firstOrNull()
                        if (oferta != null) {
                            resultado.add(crearTarjeta(oferta, contenido))
                        }
                    }
                }

                anterior = aceptar.bottom
            }

        // Respaldo: a veces el OCR no captura el botón "Aceptar". Se agrupa
        // desde cada precio hasta el siguiente precio y se valida la tarjeta.
        val cubiertas = resultado.map { it.top..it.bottom }.toMutableList()
        ordenadas.filter { esPrecio(it) }
            .forEach { precio ->
                if (cubiertas.any { rango -> precio.top in rango }) return@forEach

                val siguiente = ordenadas.firstOrNull {
                    it.top > precio.top && esPrecio(it)
                }?.top ?: Int.MAX_VALUE

                val rango = ordenadas.filter { it.top >= precio.top && it.top < siguiente }
                val contexto = ordenadas.filter {
                    it.top < precio.top &&
                        precio.top - it.bottom <= alturaMedia * 1.5 &&
                        !esEncabezado(it.texto)
                }
                val contenido = (contexto + rango)
                    .distinctBy { it.top to it.left }
                    .sortedBy { it.top }

                if (contenido.isEmpty()) return@forEach

                val oferta = ofertas(contenido.map { it.texto }).firstOrNull()
                    ?: return@forEach

                if (oferta.esPonTuPrecio &&
                    oferta.completa &&
                    resultado.none { mismaTarjeta(it.oferta, oferta) }
                ) {
                    val tarjeta = crearTarjeta(oferta, contenido)
                    resultado.add(tarjeta)
                    cubiertas.add(tarjeta.top..tarjeta.bottom)
                }
            }

        return resultado.sortedBy { it.top }
    }

    private fun crearTarjeta(oferta: OfertaLista, contenido: List<LineaOcr>): TarjetaLista =
        TarjetaLista(
            oferta = oferta,
            top = contenido.minOf { it.top },
            bottom = contenido.maxOf { it.bottom },
            left = contenido.minOf { it.left },
            right = contenido.maxOf { it.right }
        )

    private fun mismaTarjeta(a: OfertaLista, b: OfertaLista): Boolean {
        if (a.precio != b.precio ||
            a.minRecogida != b.minRecogida ||
            a.minViaje != b.minViaje
        ) {
            return false
        }
        val aRecogida = a.kmRecogida ?: return false
        val bRecogida = b.kmRecogida ?: return false
        val aViaje = a.kmViaje ?: return false
        val bViaje = b.kmViaje ?: return false
        return kotlin.math.abs(aRecogida - bRecogida) < 0.15 &&
            kotlin.math.abs(aViaje - bViaje) < 0.15
    }

    private fun esPrecio(linea: LineaOcr): Boolean {
        val valor = PRECIO.find(linea.texto)
            ?.groupValues
            ?.getOrNull(1)
            ?.replace(".", "")
            ?.replace(",", "")
            ?.toLongOrNull()
        return valor != null && valor in 1_000..200_000
    }

    private fun esEncabezado(texto: String): Boolean {
        val t = texto.lowercase()
        return t.contains("centro de solicitudes") ||
            t.contains("km al encuentro") ||
            t.contains("reservado")
    }

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
