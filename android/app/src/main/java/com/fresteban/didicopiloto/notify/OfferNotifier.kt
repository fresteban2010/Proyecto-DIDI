package com.fresteban.didicopiloto.notify

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.fresteban.didicopiloto.R
import com.fresteban.didicopiloto.bridge.PwaBridge
import com.fresteban.didicopiloto.offer.Decision
import com.fresteban.didicopiloto.offer.Offer
import com.fresteban.didicopiloto.offer.Semaforo
import java.util.Locale

/**
 * Publica el resultado del análisis como notificación heads-up.
 * Es la vía principal: no depende de que DiDi permita dibujar encima.
 */
object OfferNotifier {

    const val CANAL_ID = "ofertas_didi"
    const val NOTIFICACION_ID = 4101
    const val ACCION_IGNORAR = "com.fresteban.didicopiloto.IGNORAR_OFERTA"

    fun crearCanal(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val canal = NotificationChannel(
            CANAL_ID,
            "Ofertas de DiDi",
            NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = "Avisa si una oferta de DiDi conviene, con COP/km y COP/h."
            enableVibration(true)
            vibrationPattern = longArrayOf(0, 250, 120, 250)
            lockscreenVisibility = Notification.VISIBILITY_PRIVATE
            setShowBadge(true)
        }
        manager.createNotificationChannel(canal)
    }

    fun show(
        context: Context,
        offer: Offer,
        decision: Decision,
        viajeIncluyeRecogida: Boolean
    ) {
        if (!NotificationManagerCompat.from(context).areNotificationsEnabled()) return
        crearCanal(context)

        val (titulo, color) = when (decision.semaforo) {
            Semaforo.VERDE -> "🟢 Conviene" to Color.parseColor("#22C55E")
            Semaforo.AMARILLO -> "🟡 Aceptable" to Color.parseColor("#FACC15")
            Semaforo.ROJO -> "🔴 No conviene" to Color.parseColor("#EF4444")
        }

        val metricas = "${cop(decision.copKm.toLong())}/km · ${cop(decision.copHora.toLong())}/h"
        val detalle = buildString {
            append("Recogida: ${offer.minRecogida} min (${km(offer.kmRecogida)} km)\n")
            append("Viaje: ${offer.minViaje} min (${km(offer.kmViaje)} km)\n")
            append("Precio: ${cop(offer.precioCOP)}\n")
            append(decision.frase)
        }

        val url = PwaBridge.buildUrl(offer, viajeIncluyeRecogida = viajeIncluyeRecogida)
        val abrir = PendingIntent.getActivity(
            context,
            1001,
            Intent(Intent.ACTION_VIEW, Uri.parse(url)).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            },
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val ignorar = PendingIntent.getBroadcast(
            context,
            1002,
            Intent(context, NotificationActionReceiver::class.java)
                .setAction(ACCION_IGNORAR),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notificacion = NotificationCompat.Builder(context, CANAL_ID)
            .setSmallIcon(R.drawable.ic_oferta)
            .setColor(color)
            .setContentTitle(titulo)
            .setContentText(metricas)
            .setStyle(NotificationCompat.BigTextStyle().bigText(detalle))
            .setSubText("DIDI Copiloto")
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_STATUS)
            .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
            .setAutoCancel(true)
            .setOnlyAlertOnce(false)
            .setTimeoutAfter(60_000)
            .setContentIntent(abrir)
            .addAction(0, "Registrar", abrir)
            .addAction(0, "Ignorar", ignorar)
            .build()

        runCatching {
            NotificationManagerCompat.from(context).notify(NOTIFICACION_ID, notificacion)
        }
    }

    fun cancelar(context: Context) {
        runCatching { NotificationManagerCompat.from(context).cancel(NOTIFICACION_ID) }
    }

    private fun cop(valor: Long): String =
        "$" + String.format(Locale.US, "%,d", valor).replace(',', '.')

    private fun km(valor: Double): String =
        String.format(Locale.US, "%.1f", valor).replace('.', ',')
}
