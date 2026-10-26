package com.fresteban.didicopiloto.offer

import java.util.concurrent.CopyOnWriteArraySet

/**
 * Puente en memoria entre el listener de notificaciones y el servicio de accesibilidad.
 * Si el servicio no está conectado, el evento simplemente se descarta.
 */
object OfferBus {
    private val listeners = CopyOnWriteArraySet<(List<String>) -> Unit>()

    fun subscribe(listener: (List<String>) -> Unit) {
        listeners.add(listener)
    }

    fun unsubscribe(listener: (List<String>) -> Unit) {
        listeners.remove(listener)
    }

    fun publish(textos: List<String>) {
        listeners.forEach { runCatching { it(textos) } }
    }
}
