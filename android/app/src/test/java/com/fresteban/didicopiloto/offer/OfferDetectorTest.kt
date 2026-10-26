package com.fresteban.didicopiloto.offer

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class OfferDetectorTest {

    @Test
    fun `reconoce una oferta con precio tramos y aceptar`() {
        assertTrue(
            OfferDetector.pareceOferta(
                listOf("Efectivo", "$16.206", "8 min (1,9 km)", "35 min (11,2 km)", "Aceptar")
            )
        )
    }

    @Test
    fun `ignora una notificacion que no es oferta`() {
        assertFalse(OfferDetector.pareceOferta(listOf("Tu viaje terminó", "Califica al pasajero")))
        assertFalse(OfferDetector.pareceOferta(emptyList()))
    }
}
