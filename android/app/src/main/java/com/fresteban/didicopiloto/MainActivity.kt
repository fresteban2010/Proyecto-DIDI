package com.fresteban.didicopiloto

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.PowerManager
import android.provider.Settings
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import com.fresteban.didicopiloto.databinding.ActivityMainBinding
import com.fresteban.didicopiloto.diag.DiagnosticLog
import com.fresteban.didicopiloto.offer.OfferAccessibilityService
import com.fresteban.didicopiloto.ui.MockOfferActivity
import com.fresteban.didicopiloto.ui.SettingsActivity

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding

    private val pedirNotificaciones = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        binding.tvVersion.text = "Versión ${BuildConfig.VERSION_NAME} · datos solo en este teléfono"

        binding.btnAccesibilidad.setOnClickListener { abrirAccesibilidad() }
        binding.btnNotificaciones.setOnClickListener { abrirNotificaciones() }
        binding.btnBateria.setOnClickListener { pedirBateria() }
        binding.btnAjustes.setOnClickListener {
            startActivity(Intent(this, SettingsActivity::class.java))
        }
        binding.btnProbar.setOnClickListener {
            startActivity(Intent(this, MockOfferActivity::class.java))
        }
        binding.btnCompartir.setOnClickListener { compartirDiagnostico() }

        pedirPermisoNotificaciones()
    }

    override fun onResume() {
        super.onResume()
        actualizarEstado()
    }

    private fun actualizarEstado() {
        val activo = accesibilidadActiva()
        binding.tvEstado.text = getString(
            if (activo) R.string.status_active else R.string.status_inactive
        )
        binding.tvEstado.setTextColor(
            ContextCompat.getColor(this, if (activo) R.color.green else R.color.red)
        )
    }

    private fun accesibilidadActiva(): Boolean {
        if (!OfferAccessibilityService.conectado) {
            val habilitados = Settings.Secure.getString(
                contentResolver,
                Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
            ) ?: return false
            val servicios = habilitados.split(':')
            return servicios.any {
                it.contains(packageName) && it.contains("OfferAccessibilityService")
            }
        }
        return true
    }

    private fun abrirAccesibilidad() {
        runCatching {
            startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS))
            Toast.makeText(this, "Busca DIDI Copiloto y actívalo", Toast.LENGTH_LONG).show()
        }
    }

    private fun abrirNotificaciones() {
        runCatching {
            startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS))
        }
    }

    private fun pedirBateria() {
        val power = getSystemService(POWER_SERVICE) as PowerManager
        if (power.isIgnoringBatteryOptimizations(packageName)) {
            Toast.makeText(this, "La batería ya está sin restricciones", Toast.LENGTH_SHORT).show()
            return
        }
        runCatching {
            startActivity(
                Intent(
                    Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
                    Uri.parse("package:$packageName")
                )
            )
        }
    }

    private fun pedirPermisoNotificaciones() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            val concedido = ContextCompat.checkSelfPermission(
                this,
                Manifest.permission.POST_NOTIFICATIONS
            ) == PackageManager.PERMISSION_GRANTED
            if (!concedido) pedirNotificaciones.launch(Manifest.permission.POST_NOTIFICATIONS)
        }
    }

    private fun compartirDiagnostico() {
        val intent = DiagnosticLog.shareIntent(this)
        if (intent == null) {
            Toast.makeText(this, "Todavía no hay ofertas registradas", Toast.LENGTH_SHORT).show()
            return
        }
        startActivity(Intent.createChooser(intent, "Compartir diagnóstico"))
    }
}
