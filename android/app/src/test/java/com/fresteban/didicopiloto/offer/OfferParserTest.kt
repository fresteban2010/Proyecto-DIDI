package com.fresteban.didicopiloto.offer

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test

class OfferParserTest {

    private val ofertaReal = listOf(
        "Efectivo",
        "$16.206",
        "$1.600 adicionales",
        "$608 de tarifa base dinámica",
        "$1.400 de tarifa de gasolina",
        "4,84 · 136 arrendamientos",
        "8 min (1,9 km)",
        "Calle 68a #86a-17, Engativá",
        "35 min (11,2 km)",
        "Conjunto Residencial Boreal Portería Américas, Kennedy",
        "Aceptar"
    )

    @Test
    fun `parsea la oferta real de la captura`() {
        val offer = OfferParser.parse(ofertaReal)
        assertNotNull(offer)
        requireNotNull(offer)

        assertEquals(16_206L, offer.precioCOP)
        assertEquals(1.9, offer.kmRecogida, 0.001)
        assertEquals(8, offer.minRecogida)
        assertEquals(11.2, offer.kmViaje, 0.001)
        assertEquals(35, offer.minViaje)
        assertEquals("efectivo", offer.metodoPago)
    }

    @Test
    fun `une precios partidos por el arbol de accesibilidad`() {
        val offer = OfferParser.parse(
            listOf("Efectivo", "$16.", "206", "8 min (1,9 km)", "35 min (11,2 km)")
        )

        assertEquals(16_206L, offer?.precioCOP)
    }

    @Test
    fun `ignora los montos del desglose y toma el total`() {
        val offer = OfferParser.parse(
            listOf("$1.600", "$608", "$1.400", "$16.206", "8 min (1,9 km)", "35 min (11,2 km)")
        )

        assertEquals(16_206L, offer?.precioCOP)
    }

    @Test
    fun `detecta pago con tarjeta`() {
        val offer = OfferParser.parse(
            listOf("Tarjeta", "$10.000", "4 min (1,0 km)", "12 min (5,0 km)")
        )

        assertEquals("tarjeta", offer?.metodoPago)
    }

    @Test
    fun `si aparecen ambos metodos no asume tarjeta`() {
        val offer = OfferParser.parse(
            listOf("Efectivo", "Tarjeta", "$10.000", "4 min (1,0 km)", "12 min (5,0 km)")
        )

        assertEquals("efectivo", offer?.metodoPago)
    }

    @Test
    fun `tolera espacios duros en los tramos`() {
        val offer = OfferParser.parse(
            listOf("$16.206", "8\u00A0min\u00A0(1,9\u00A0km)", "35\u00A0min\u00A0(11,2 km)")
        )

        assertEquals(1.9, offer?.kmRecogida ?: 0.0, 0.001)
        assertEquals(11.2, offer?.kmViaje ?: 0.0, 0.001)
    }

    @Test
    fun `ignora un ETA del mapa anterior al precio`() {
        val offer = OfferParser.parse(
            listOf(
                "12 min (4,3 km)",
                "$16.206",
                "8 min (1,9 km)",
                "35 min (11,2 km)"
            )
        )

        assertEquals(8, offer?.minRecogida)
        assertEquals(35, offer?.minViaje)
    }

    @Test
    fun `prioriza el monto junto a la etiqueta total`() {
        val offer = OfferParser.parse(
            listOf(
                "$20.000 propina estimada",
                "Total $16.206",
                "8 min (1,9 km)",
                "35 min (11,2 km)"
            )
        )

        assertEquals(16_206L, offer?.precioCOP)
    }

    @Test
    fun `sin precio o sin tramos devuelve null`() {
        assertNull(OfferParser.parse(listOf("Efectivo", "Aceptar")))
        assertNull(OfferParser.parse(listOf("$16.206", "Aceptar")))
        assertNull(OfferParser.parse(emptyList()))
    }

    @Test
    fun `rechaza valores fuera de rango`() {
        assertNull(OfferParser.parse(listOf("$999", "8 min (1,9 km)", "35 min (11,2 km)")))
        assertNull(OfferParser.parse(listOf("$16.206", "8 min (1,9 km)", "0 min (0 km)")))
    }
}
