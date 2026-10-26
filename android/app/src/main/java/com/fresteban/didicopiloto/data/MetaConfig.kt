package com.fresteban.didicopiloto.data

data class MetaConfig(
    val metaCopHora: Int = 30_000,
    val metaCopKm: Int = 2_000,
    val precioGalonCOP: Int = 16_000,
    val rendimientoKmGalon: Double = 40.0,
    val viajeIncluyeRecogida: Boolean = false
) {
    fun esValida(): Boolean =
        metaCopHora > 0 &&
            metaCopKm > 0 &&
            precioGalonCOP > 0 &&
            rendimientoKmGalon > 0.0
}
