package com.fresteban.didicopiloto

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.provider.Settings
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat

class BootReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent?) {
        if (intent?.action != Intent.ACTION_BOOT_COMPLETED) return
        if (accesibilidadActiva(context)) return
        if (!puedeNotificar(context)) return

        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.createNotificationChannel(
            NotificationChannel(
                CANAL,
                "Estado del copiloto",
                NotificationManager.IMPORTANCE_DEFAULT
            )
        )

        val abrir = PendingIntent.getActivity(
            context,
            0,
            Intent(context, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        val notificacion = NotificationCompat.Builder(context, CANAL)
            .setSmallIcon(R.drawable.ic_launcher)
            .setContentTitle("DIDI Copiloto está apagado")
            .setContentText("Activa la accesibilidad para volver a analizar ofertas.")
            .setContentIntent(abrir)
            .setAutoCancel(true)
            .build()

        runCatching { manager.notify(1, notificacion) }
    }

    private fun accesibilidadActiva(context: Context): Boolean {
        val habilitados = Settings.Secure.getString(
            context.contentResolver,
            Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
        ) ?: return false
        return habilitados.split(':').any {
            it.contains(context.packageName) && it.contains("OfferAccessibilityService")
        }
    }

    private fun puedeNotificar(context: Context): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return true
        return ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.POST_NOTIFICATIONS
        ) == PackageManager.PERMISSION_GRANTED
    }

    companion object {
        private const val CANAL = "copiloto_estado"
    }
}
