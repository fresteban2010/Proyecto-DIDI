package com.fresteban.didicopiloto.bridge

import com.fresteban.didicopiloto.offer.Offer
import org.junit.Assert.assertEquals
import org.junit.Test

class PwaBridgeTest {

    @Test
    fun `construye la URL de registro con la oferta real`() {
        val offer = Offer(
            precioCOP = 16_206,
            kmRecogida = 1.9,
            minRecogida = 8,
            kmViaje = 11.2,
            minViaje = 35,
            metodoPago = "efectivo"
        )

        val url = PwaBridge.buildUrl(offer, "https://example.com/app/")

        assertEquals(
            "https://example.com/app/?registrar=1&precio=16206&kmRecogida=1.9&minRecogida=8&kmViaje=11.2&minViaje=35&metodo=efectivo",
            url
        )
    }

    @Test
    fun `no duplica la barra final`() {
        val offer = Offer(10_000, 0.0, 0, 5.0, 12)
        val url = PwaBridge.buildUrl(offer, "https://example.com/app")

        assertEquals(true, url.startsWith("https://example.com/app/?registrar=1"))
    }
}
