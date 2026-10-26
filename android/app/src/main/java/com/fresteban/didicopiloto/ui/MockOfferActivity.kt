package com.fresteban.didicopiloto.ui

import android.os.Bundle
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.fresteban.didicopiloto.databinding.ActivityMockOfferBinding

/**
 * Pantalla de prueba con los mismos textos de una oferta real de DiDi.
 * Sirve para validar el parser y el overlay sin depender de una oferta en vivo.
 */
class MockOfferActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMockOfferBinding

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMockOfferBinding.inflate(layoutInflater)
        setContentView(binding.root)

        binding.btnAceptarMock.setOnClickListener {
            Toast.makeText(this, "Oferta de prueba aceptada (no se envía a DiDi)", Toast.LENGTH_SHORT).show()
        }
    }
}
