package com.fresteban.didicopiloto.ui

import android.content.Intent
import android.os.Bundle
import android.provider.Settings
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.fresteban.didicopiloto.R
import com.fresteban.didicopiloto.data.MetaConfig
import com.fresteban.didicopiloto.data.SettingsRepository
import com.fresteban.didicopiloto.data.SharedPrefsStore
import com.fresteban.didicopiloto.databinding.ActivitySettingsBinding

class SettingsActivity : AppCompatActivity() {

    private lateinit var binding: ActivitySettingsBinding
    private lateinit var repo: SettingsRepository

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivitySettingsBinding.inflate(layoutInflater)
        setContentView(binding.root)

        repo = SettingsRepository(SharedPrefsStore(this))
        cargar()

        binding.btnGuardar.setOnClickListener { guardar() }
        binding.btnAccesibilidadAyuda.setOnClickListener {
            startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS))
        }
    }

    private fun cargar() {
        val config = repo.load()
        binding.etMetaHora.setText(config.metaCopHora.toString())
        binding.etMetaKm.setText(config.metaCopKm.toString())
        binding.etGalon.setText(config.precioGalonCOP.toString())
        binding.etRendimiento.setText(config.rendimientoKmGalon.toString())
        binding.swRecogida.isChecked = config.viajeIncluyeRecogida
    }

    private fun guardar() {
        val metaHora = binding.etMetaHora.text.toString().toIntOrNull() ?: 0
        val metaKm = binding.etMetaKm.text.toString().toIntOrNull() ?: 0
        val galon = binding.etGalon.text.toString().toIntOrNull() ?: 0
        val rendimiento = binding.etRendimiento.text.toString().replace(',', '.').toDoubleOrNull() ?: 0.0

        val config = MetaConfig(
            metaCopHora = metaHora,
            metaCopKm = metaKm,
            precioGalonCOP = galon,
            rendimientoKmGalon = rendimiento,
            viajeIncluyeRecogida = binding.swRecogida.isChecked
        )

        if (!config.esValida()) {
            Toast.makeText(this, R.string.settings_invalid, Toast.LENGTH_LONG).show()
            return
        }

        repo.save(config)
        Toast.makeText(this, R.string.settings_saved, Toast.LENGTH_SHORT).show()
        finish()
    }
}
