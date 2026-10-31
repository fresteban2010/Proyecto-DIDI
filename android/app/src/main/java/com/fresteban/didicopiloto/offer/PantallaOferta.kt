package com.fresteban.didicopiloto.offer

/**
 * Distingue qué está mostrando DiDi y evita que el OCR lea nuestras propias
 * notificaciones (eso creaba ofertas falsas y un bucle de notificaciones).
 */
object PantallaOferta {

    fun esNuestraNotificacion(textos: List<String>): Boolean {
        val unido = textos.joinToString(" ").lowercase()
        val marca = unido.contains("didi copiloto")
        val metricas = unido.contains("/km") || unido.contains("/h")
        val acciones = unido.contains("registrar") || unido.contains("ignorar")
        val titulo =
            unido.contains("conviene") ||
                unido.contains("aceptable") ||
                unido.contains("no conviene")

        return (marca && (acciones || metricas)) ||
            (acciones && titulo && metricas)
    }

    /** Lista de solicitudes (no es una oferta que salta). */
    fun esCentroDeSolicitudes(textos: List<String>): Boolean {
        val unido = textos.joinToString(" ").lowercase()
        // "solicitud" cubre el singular y las lecturas truncadas del OCR.
        return unido.contains("centro de solicitud") ||
            unido.contains("km al encuentro")
    }

    fun esPonTuPrecio(textos: List<String>): Boolean {
        // Tolerante a "Precio", "Preclo", "Preci0" y truncados.
        return textos.joinToString(" ").lowercase().contains("pon tu")
    }
}
