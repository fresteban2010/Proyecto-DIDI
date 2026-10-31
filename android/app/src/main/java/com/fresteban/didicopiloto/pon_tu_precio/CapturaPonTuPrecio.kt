package com.fresteban.didicopiloto.pon_tu_precio

/** Una captura de la lista "Centro de solicitudes" con ofertas Pon tu precio. */
data class CapturaPonTuPrecio(
    val ts: Long,
    val imagen: String,
    val precios: List<Long>,
    val tramos: List<String>,
    val texto: String
)
