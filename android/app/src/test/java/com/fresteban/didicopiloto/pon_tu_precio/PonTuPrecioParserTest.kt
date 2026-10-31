package com.fresteban.didicopiloto.pon_tu_precio

import com.fresteban.didicopiloto.offer.LineaOcr
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class PonTuPrecioParserTest {

    private val listaReal = listOf(
        "11:43",
        "< Centro de solicitudes",
        "Km al encuentro",
        "Reservado",
        "Express Nuevo",
        "$13.607",
        "(9 min 3,2 km) Carrera 108 #64f-4, Engativá",
        "(33 min 8,2 km) Calle 77 #69-06, Engativá",
        "Aceptar",
        "$9.984+",
        "Tiempo re",
        "Pon Tu Precio Nuevo Más alto que..."
    )

    @Test
    fun `separa cada tarjeta de la lista`() {
        val ofertas = PonTuPrecioParser.ofertas(listaReal)
        assertEquals(2, ofertas.size)

        val express = ofertas[0]
        assertEquals(13_607L, express.precio)
        assertTrue(express.completa)
        assertFalse(express.esPonTuPrecio)
        assertEquals(9, express.minRecogida)
        assertEquals(3.2, express.kmRecogida ?: 0.0, 0.001)
        assertEquals(33, express.minViaje)
        assertEquals(8.2, express.kmViaje ?: 0.0, 0.001)
    }

    @Test
    fun `deja incompleta la tarjeta que no alcanza a mostrar tramos`() {
        val pon = PonTuPrecioParser.ofertas(listaReal).first { it.esPonTuPrecio }
        assertEquals(9_984L, pon.precio)
        assertFalse(pon.completa)
    }

    @Test
    fun `analiza una tarjeta Pon tu precio completa`() {
        val ofertas = PonTuPrecioParser.ofertas(
            listOf(
                "Centro de solicitudes",
                "Pon Tu Precio Nuevo",
                "$15.078",
                "8 min (1,7 km)",
                "29 min (7,1 km)",
                "Aceptar $15.078"
            )
        )

        assertEquals(1, ofertas.size)
        val oferta = ofertas.first()
        assertTrue(oferta.esPonTuPrecio)
        assertTrue(oferta.completa)
        assertEquals(15_078L, oferta.precio)
        assertEquals(8, oferta.minRecogida)
        assertEquals(1.7, oferta.kmRecogida ?: 0.0, 0.001)
        assertEquals(29, oferta.minViaje)
        assertEquals(7.1, oferta.kmViaje ?: 0.0, 0.001)
    }

    @Test
    fun `separa dos tarjetas Pon tu precio`() {
        val ofertas = PonTuPrecioParser.ofertas(
            listOf(
                "Pon Tu Precio A",
                "$10.000",
                "5 min (1 km)",
                "20 min (5 km)",
                "Aceptar",
                "Pon Tu Precio B",
                "$12.000",
                "6 min (2 km)",
                "25 min (6 km)",
                "Aceptar"
            )
        ).filter { it.esPonTuPrecio }

        assertEquals(2, ofertas.size)
        assertEquals(listOf(10_000L, 12_000L), ofertas.map { it.precio })
        assertTrue(ofertas.all { it.completa })
    }

    @Test
    fun `agrupa dos tarjetas y calcula el rectangulo de cada una`() {
        val lineas = listOf(
            linea("Centro de solicitudes", 50, 80),
            linea("Express Nuevo", 120, 150),
            linea("$13.607", 160, 190),
            linea("(9 min 3,2 km)", 200, 230),
            linea("(33 min 8,2 km)", 240, 270),
            linea("Aceptar", 280, 310),
            linea("Pon Tu Precio Nuevo", 350, 380),
            linea("$15.078", 390, 420),
            linea("8 min (1,7 km)", 430, 460),
            linea("29 min (7,1 km)", 470, 500),
            linea("Aceptar", 510, 540)
        )

        val tarjetas = PonTuPrecioParser.tarjetas(lineas)
        assertEquals(2, tarjetas.size)

        val express = tarjetas[0]
        assertFalse(express.oferta.esPonTuPrecio)
        assertEquals(13_607L, express.oferta.precio)
        assertEquals(120, express.top)
        assertEquals(310, express.bottom)

        val pon = tarjetas[1]
        assertTrue(pon.oferta.esPonTuPrecio)
        assertTrue(pon.oferta.completa)
        assertEquals(15_078L, pon.oferta.precio)
        assertEquals(350, pon.top)
        assertEquals(540, pon.bottom)
    }

    @Test
    fun `agrupa una tarjeta aunque el OCR no capture Aceptar`() {
        val lineas = listOf(
            linea("Centro de solicitudes", 50, 80),
            linea("Pon Tu Precio Nuevo", 120, 150),
            linea("$15.078", 160, 190),
            linea("8 min (1,7 km)", 200, 230),
            linea("29 min (7,1 km)", 240, 270)
        )

        val tarjetas = PonTuPrecioParser.tarjetas(lineas)
        assertEquals(1, tarjetas.size)
        assertTrue(tarjetas.first().oferta.esPonTuPrecio)
        assertTrue(tarjetas.first().oferta.completa)
        assertEquals(15_078L, tarjetas.first().oferta.precio)
    }

    @Test
    fun `dos tarjetas con el mismo precio y ruta distinta no se mezclan`() {
        val lineas = listOf(
            linea("Pon Tu Precio A", 120, 150),
            linea("$15.000", 160, 190),
            linea("5 min (1 km)", 200, 230),
            linea("20 min (5 km)", 240, 270),
            linea("Aceptar", 280, 310),
            linea("Pon Tu Precio B", 350, 380),
            linea("$15.000", 390, 420),
            linea("8 min (2 km)", 430, 460),
            linea("30 min (9 km)", 470, 500),
            linea("Aceptar", 510, 540)
        )

        val tarjetas = PonTuPrecioParser.tarjetas(lineas)
            .filter { it.oferta.esPonTuPrecio }

        assertEquals(2, tarjetas.size)
        assertEquals(1.0, tarjetas[0].oferta.kmRecogida ?: 0.0, 0.001)
        assertEquals(2.0, tarjetas[1].oferta.kmRecogida ?: 0.0, 0.001)
    }

    @Test
    fun `mantiene incompleta una tarjeta sin los dos tramos`() {
        val lineas = listOf(
            linea("Pon Tu Precio Nuevo", 350, 380),
            linea("$9.984", 390, 420),
            linea("Aceptar", 510, 540)
        )

        val tarjeta = PonTuPrecioParser.tarjetas(lineas).first()
        assertTrue(tarjeta.oferta.esPonTuPrecio)
        assertFalse(tarjeta.oferta.completa)
    }

    private fun linea(texto: String, top: Int, bottom: Int): LineaOcr =
        LineaOcr(texto = texto, top = top, bottom = bottom, left = 60, right = 1100)

    @Test
    fun `convierte metros a kilometros`() {
        val oferta = PonTuPrecioParser.ofertas(
            listOf("Pon Tu Precio", "$9.000", "3 min (351 m)", "15 min (7 km)", "Aceptar")
        ).first()

        assertEquals(0.351, oferta.kmRecogida ?: 0.0, 0.0001)
        assertEquals(7.0, oferta.kmViaje ?: 0.0, 0.001)
    }
}
