package com.fresteban.didicopiloto.offer

import com.fresteban.didicopiloto.data.MetaConfig
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class DecisionEngineTest {

    private val ofertaReal = Offer(
        precioCOP = 16_206,
        kmRecogida = 1.9,
        minRecogida = 8,
        kmViaje = 11.2,
        minViaje = 35
    )

    @Test
    fun `la oferta real queda en rojo con las metas por defecto`() {
        val decision = DecisionEngine.evaluar(ofertaReal, MetaConfig())

        assertEquals(13.1, decision.kmTotal, 0.001)
        assertEquals(43, decision.minTotal)
        assertEquals(1_237.1, decision.copKm, 0.1)
        assertEquals(22_613.0, decision.copHora, 1.0)
        assertEquals(5_240L, decision.gasolinaCOP)
        assertEquals(10_966L, decision.netoCOP)
        assertEquals(Semaforo.ROJO, decision.semaforo)
        assertTrue(decision.frase.contains("1.237"))
        assertTrue(decision.frase.contains("22.613"))
    }

    @Test
    fun `si el viaje incluye la recogida sube el COP por hora`() {
        val decision = DecisionEngine.evaluar(ofertaReal, MetaConfig(viajeIncluyeRecogida = true))

        assertEquals(35, decision.minTotal)
        assertEquals(27_781.7, decision.copHora, 1.0)
        assertEquals(Semaforo.ROJO, decision.semaforo)
    }

    @Test
    fun `verde cuando cumple las dos metas`() {
        val decision = DecisionEngine.evaluar(
            Offer(precioCOP = 20_000, kmRecogida = 0.0, minRecogida = 0, kmViaje = 10.0, minViaje = 20),
            MetaConfig()
        )

        assertEquals(Semaforo.VERDE, decision.semaforo)
    }

    @Test
    fun `amarillo cuando cumple solo una meta`() {
        val decision = DecisionEngine.evaluar(
            Offer(precioCOP = 20_000, kmRecogida = 0.0, minRecogida = 0, kmViaje = 10.0, minViaje = 50),
            MetaConfig()
        )

        assertEquals(2_000.0, decision.copKm, 0.1)
        assertEquals(24_000.0, decision.copHora, 0.1)
        assertEquals(Semaforo.AMARILLO, decision.semaforo)
    }

    @Test
    fun `una configuracion invalida no produce un verde falso`() {
        val decision = DecisionEngine.evaluar(
            ofertaReal,
            MetaConfig(metaCopHora = 0, metaCopKm = 0, precioGalonCOP = 0, rendimientoKmGalon = 0.0)
        )

        assertEquals(Semaforo.ROJO, decision.semaforo)
        assertEquals(5_240L, decision.gasolinaCOP)
    }

    @Test
    fun `amarillo cuando llega al ochenta por ciento de ambas metas`() {
        val decision = DecisionEngine.evaluar(
            Offer(precioCOP = 16_000, kmRecogida = 0.0, minRecogida = 0, kmViaje = 10.0, minViaje = 40),
            MetaConfig()
        )

        assertEquals(1_600.0, decision.copKm, 0.1)
        assertEquals(24_000.0, decision.copHora, 0.1)
        assertEquals(Semaforo.AMARILLO, decision.semaforo)
    }
}
