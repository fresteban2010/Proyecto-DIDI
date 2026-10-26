package com.fresteban.didicopiloto.notify

import android.app.Notification
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import com.fresteban.didicopiloto.diag.DiagnosticLog
import com.fresteban.didicopiloto.offer.OfferAccessibilityService
import com.fresteban.didicopiloto.offer.OfferBus
import com.fresteban.didicopiloto.offer.OfferDetector

class OfferNotificationListener : NotificationListenerService() {

    override fun onNotificationPosted(sbn: StatusBarNotification?) {
        if (sbn == null) return
        if (sbn.packageName != OfferAccessibilityService.DIDI_PACKAGE) return

        val extras = sbn.notification?.extras ?: return
        val textos = listOfNotNull(
            extras.getCharSequence(Notification.EXTRA_TITLE)?.toString(),
            extras.getCharSequence(Notification.EXTRA_TEXT)?.toString(),
            extras.getCharSequence(Notification.EXTRA_BIG_TEXT)?.toString(),
            extras.getCharSequence(Notification.EXTRA_SUMMARY_TEXT)?.toString(),
            sbn.notification?.tickerText?.toString()
        ).filter { it.isNotBlank() }.distinct()

        if (textos.isEmpty()) return

        DiagnosticLog.append(this, "notificacion_didi", textos)
        if (!OfferDetector.pareceOferta(textos)) return
        OfferBus.publish(textos)
    }
}
