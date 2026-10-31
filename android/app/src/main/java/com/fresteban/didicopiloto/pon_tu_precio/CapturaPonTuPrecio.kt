package com.fresteban.didicopiloto.pon_tu_precio

/** Una oferta individual capturada de la lista "Centro de solicitudes". */
data class CapturaPonTuPrecio(
    val ts: Long,
    val imagen: String,
    val precio: Long,
    val minRecogida: Int?,
    val kmRecogida: Double?,
    val minViaje: Int?,
    val kmViaje: Double?,
    val copKm: Double?,
    val copHora: Double?,
    val semaforo: String?,
    val frase: String?,
    val texto: String
) {
    val completa: Boolean
        get() = minRecogida != null && kmRecogida != null &&
            minViaje != null && kmViaje != null
}
