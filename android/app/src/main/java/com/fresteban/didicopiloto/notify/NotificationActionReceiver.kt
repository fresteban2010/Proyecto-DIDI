package com.fresteban.didicopiloto.notify

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** Acciones de la notificación de ofertas (por ahora, "Ignorar"). */
class NotificationActionReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        if (intent?.action == OfferNotifier.ACCION_IGNORAR) {
            OfferNotifier.cancelar(context)
        }
    }
}
