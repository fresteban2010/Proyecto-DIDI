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
    fun `convierte la recogida en metros a kilometros`() {
        val offer = OfferParser.parse(
            listOf(
                "Pago con tarjeta",
                "$16.003",
                "5 min (753 m)",
                "Travessa 93 #65a-99, Engativá",
                "44 min (10,2 km)",
                "Aceptar"
            )
        )

        assertEquals(16_003L, offer?.precioCOP)
        assertEquals(0.753, offer?.kmRecogida ?: 0.0, 0.0001)
        assertEquals(10.2, offer?.kmViaje ?: 0.0, 0.001)
        assertEquals(5, offer?.minRecogida)
        assertEquals(44, offer?.minViaje)
    }

    @Test
    fun `parsea texto tipico de OCR`() {
        val offer = OfferParser.parse(
            listOf(
                "Efectivo",
                "$ 16.206",
                "8 min (1,9 km)",
                "Calle 68a #86a-17, Engativá",
                "35 min (11.2 km)",
                "Aceptar"
            )
        )

        assertEquals(16_206L, offer?.precioCOP)
        assertEquals(1.9, offer?.kmRecogida ?: 0.0, 0.001)
        assertEquals(11.2, offer?.kmViaje ?: 0.0, 0.001)
    }

    @Test
    fun `acepta separador de miles con coma`() {
        val offer = OfferParser.parse(
            listOf("$16,206", "8 min (1,9 km)", "35 min (11,2 km)")
        )

        assertEquals(16_206L, offer?.precioCOP)
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

    @Test
    fun `separa el multiplicador pegado al precio por el OCR`() {
        val offer = OfferParser.parse(
            listOf(
                "Pago con tarjeta",
                "$17.7941,5x",
                "$2.438 de tarifa de gasolina",
                "6 min (2,1 km)",
                "15 min (7 km)",
                "Aceptar"
            )
        )

        assertEquals(17_794L, offer?.precioCOP)
        assertEquals(2.1, offer?.kmRecogida ?: 0.0, 0.001)
        assertEquals(7.0, offer?.kmViaje ?: 0.0, 0.001)
    }

    @Test
    fun `corrige la letra O del OCR dentro del precio`() {
        val offer = OfferParser.parse(
            listOf(
                "Efectivo",
                "$1709O:14x",
                "$2.086 de tarifa base dinámica",
                "$950 de tarifa de gasolina",
                "3 min (924 m)",
                "15 min (7,6 km)",
                "Aceptar"
            )
        )

        assertEquals(17_090L, offer?.precioCOP)
    }

    @Test
    fun `encuentra los tramos aunque los botones de precio vengan despues`() {
        val offer = OfferParser.parse(
            listOf(
                "Pon Tu Precio Efectivo",
                "NO Y 51D35%",
                "Rechazo permitido",
                "$30.209 1,3x",
                "$2.438 de tarifa de gasolina",
                "3 min (773 m)",
                "36 min (19,4 km)",
                "Aceptar $30.209",
                "$32.409",
                "$33.509",
                "$34.609"
            )
        )

        assertEquals(30_209L, offer?.precioCOP)
        assertEquals(0.773, offer?.kmRecogida ?: 0.0, 0.0001)
        assertEquals(19.4, offer?.kmViaje ?: 0.0, 0.001)
    }

    @Test
    fun `parsea oferta con recogida en metros y botones de precio al final`() {
        val offer = OfferParser.parse(
            listOf(
                "Pon Tu Precio Bancolombia",
                "Rechazo permitido",
                "$15.300+1,5x",
                "9 $900 de tarifa de gasolina",
                "3 min (351 m)",
                "Conjunto Residencial Pinar De Los Alamos, Engativá",
                "27 min (7,2 km)",
                "Conjunto Mirador de Castilla 3, Kennedy",
                "Aceptar $15.300",
                "$16.500",
                "$17.000",
                "$17.600"
            )
        )

        assertEquals(15_300L, offer?.precioCOP)
        assertEquals(0.351, offer?.kmRecogida ?: 0.0, 0.0001)
        assertEquals(7.2, offer?.kmViaje ?: 0.0, 0.001)
        assertEquals(3, offer?.minRecogida)
        assertEquals(27, offer?.minViaje)
    }

    @Test
    fun `parsea la oferta real capturada en vivo`() {
        val offer = OfferParser.parse(
            listOf(
                "11:29",
                "Pago con tarjeta",
                "$20.800",
                "9 $2.000 adicionales",
                "S $1.197 de tarifa base dinámica",
                "9 $1.350 de tarifa de gasolina",
                "9 min (1,1 km)",
                "67P7MVMM+FX, Engativá",
                "51 min (10,8 km)",
                "Aceptar",
                "Calle 52a Sur #80a-48, Kennedy"
            )
        )

        assertEquals(20_800L, offer?.precioCOP)
        assertEquals(1.1, offer?.kmRecogida ?: 0.0, 0.001)
        assertEquals(10.8, offer?.kmViaje ?: 0.0, 0.001)
        assertEquals(9, offer?.minRecogida)
        assertEquals(51, offer?.minViaje)
    }
}
