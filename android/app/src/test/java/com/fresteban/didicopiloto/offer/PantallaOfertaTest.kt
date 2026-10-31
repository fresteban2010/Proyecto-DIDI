package com.fresteban.didicopiloto.offer

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class PantallaOfertaTest {

    private val notificacionPropia = listOf(
        "11:43 O",
        "DIDI Copiloto",
        "Aceptable",
        "$1.713/km $24.450/h",
        "Registrar",
        "Pon Tu Precio Efectivo",
        "8 min (1,7 km)",
        "29 min (7,1 km)",
        "Ignorar"
    )

    private val ofertaPopup = listOf(
        "11:43",
        "Efectivo",
        "$12.498-1,1x",
        "9 min (1,1 km)",
        "27 min (5,9 km)",
        "Aceptar"
    )

    private val centroSolicitudes = listOf(
        "Centro de solicitudes",
        "Km al encuentro",
        "Express Nuevo",
        "$13.607",
        "(9 min 3,2 km)",
        "(33 min 8,2 km)",
        "Aceptar",
        "$9.984+",
        "Pon Tu Precio Nuevo"
    )

    @Test
    fun `detecta nuestra propia notificacion`() {
        assertTrue(PantallaOferta.esNuestraNotificacion(notificacionPropia))
    }

    @Test
    fun `no confunde una oferta popup con nuestra notificacion`() {
        assertFalse(PantallaOferta.esNuestraNotificacion(ofertaPopup))
    }

    @Test
    fun `detecta la lista centro de solicitudes`() {
        assertTrue(PantallaOferta.esCentroDeSolicitudes(centroSolicitudes))
    }

    @Test
    fun `tolera centro de solicitud truncado por el OCR`() {
        assertTrue(
            PantallaOferta.esCentroDeSolicitudes(
                listOf("Centro de solicitude...", "Pon Tu Preclo Nuevo")
            )
        )
    }

    @Test
    fun `tolera errores del OCR en pon tu precio`() {
        assertTrue(PantallaOferta.esPonTuPrecio(listOf("Pon Tu Preclo Nuevo")))
        assertTrue(PantallaOferta.esPonTuPrecio(listOf("Pon Tu Preci0")))
    }

    @Test
    fun `una oferta popup no es la lista`() {
        assertFalse(PantallaOferta.esCentroDeSolicitudes(ofertaPopup))
    }

    @Test
    fun `ambas pueden contener pon tu precio`() {
        assertTrue(PantallaOferta.esPonTuPrecio(centroSolicitudes))
        assertTrue(
            PantallaOferta.esPonTuPrecio(
                listOf("Pon Tu Precio Efectivo", "$15.078", "Aceptar $15.078")
            )
        )
    }
}
