package com.fresteban.didicopiloto.offer

/**
 * Oferta tal como la muestra DiDi Conductor.
 * Las distancias están en km y los tiempos en minutos.
 */
data class Offer(
    val precioCOP: Long,
    val kmRecogida: Double,
    val minRecogida: Int,
    val kmViaje: Double,
    val minViaje: Int,
    val metodoPago: String = "efectivo",
    val direccionRecogida: String? = null,
    val direccionDestino: String? = null,
    val crudo: String = ""
)
