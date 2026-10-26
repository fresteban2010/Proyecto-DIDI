package com.fresteban.didicopiloto.offer

/**
 * Heurística barata para decidir si un conjunto de textos parece una oferta.
 * Se usa antes de recorrer/parsear para no procesar pantallas que no son ofertas.
 */
object OfferDetector {
    fun pareceOferta(textos: List<String>): Boolean {
        if (textos.isEmpty()) return false
        val unido = textos.joinToString(" ").lowercase()
        return unido.contains("aceptar") &&
            unido.contains("$") &&
            unido.contains("min") &&
            unido.contains("km")
    }
}
