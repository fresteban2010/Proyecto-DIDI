package com.fresteban.didicopiloto.ui

import android.app.AlertDialog
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import com.fresteban.didicopiloto.R
import com.fresteban.didicopiloto.bridge.PwaBridge
import com.fresteban.didicopiloto.pon_tu_precio.CapturaPonTuPrecio
import com.fresteban.didicopiloto.pon_tu_precio.PonTuPrecioRepository
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/** Lista las capturas de "Pon tu precio" que no saltaron como oferta. */
class PonTuPrecioActivity : AppCompatActivity() {

    private lateinit var contenedor: LinearLayout
    private lateinit var tvVacio: TextView
    private lateinit var scroll: View

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_pon_tu_precio)

        contenedor = findViewById(R.id.contenedorPonTuPrecio)
        tvVacio = findViewById(R.id.tvVacioPonTuPrecio)
        scroll = findViewById(R.id.scrollPonTuPrecio)
        findViewById<View>(R.id.btnLimpiarPonTuPrecio).setOnClickListener {
            confirmarLimpiar()
        }
        cargar()
    }

    override fun onResume() {
        super.onResume()
        cargar()
    }

    private fun cargar() {
        contenedor.removeAllViews()
        val lista = PonTuPrecioRepository.listar(this)
        val vacio = lista.isEmpty()
        tvVacio.visibility = if (vacio) View.VISIBLE else View.GONE
        scroll.visibility = if (vacio) View.GONE else View.VISIBLE
        lista.forEach { contenedor.addView(crearItem(it)) }
    }

    private fun crearItem(captura: CapturaPonTuPrecio): View {
        val item = LayoutInflater.from(this)
            .inflate(R.layout.item_pon_tu_precio, contenedor, false)

        val fecha = SimpleDateFormat("dd MMM · HH:mm", Locale("es", "CO"))
            .format(Date(captura.ts))
        item.findViewById<TextView>(R.id.tvFechaPonTuPrecio).text = fecha
        item.findViewById<TextView>(R.id.tvPreciosPonTuPrecio).text = cop(captura.precio)

        val semaforo = item.findViewById<TextView>(R.id.tvSemaforoPonTuPrecio)
        when (captura.semaforo) {
            "VERDE" -> {
                semaforo.text = "🟢 Conviene"
                semaforo.setTextColor(ContextCompat.getColor(this, R.color.green))
            }
            "AMARILLO" -> {
                semaforo.text = "🟡 Aceptable"
                semaforo.setTextColor(ContextCompat.getColor(this, R.color.yellow))
            }
            "ROJO" -> {
                semaforo.text = "🔴 No conviene"
                semaforo.setTextColor(ContextCompat.getColor(this, R.color.red))
            }
            else -> {
                semaforo.text = getString(R.string.pon_tu_precio_no_analysis)
                semaforo.setTextColor(ContextCompat.getColor(this, R.color.muted))
            }
        }

        val metricas = item.findViewById<TextView>(R.id.tvMetricasPonTuPrecio)
        if (captura.copKm != null && captura.copHora != null) {
            metricas.text =
                "${cop(captura.copKm.toLong())}/km · ${cop(captura.copHora.toLong())}/h"
            metricas.visibility = View.VISIBLE
        } else {
            metricas.text = ""
            metricas.visibility = View.GONE
        }

        item.findViewById<TextView>(R.id.tvTramosPonTuPrecio).text =
            if (captura.completa) {
                "Recogida: ${captura.minRecogida} min · ${km(captura.kmRecogida ?: 0.0)} km\n" +
                    "Viaje: ${captura.minViaje} min · ${km(captura.kmViaje ?: 0.0)} km"
            } else {
                getString(R.string.pon_tu_precio_no_tramos)
            }

        val frase = item.findViewById<TextView>(R.id.tvFrasePonTuPrecio)
        frase.text = captura.frase ?: ""
        frase.visibility = if (captura.frase.isNullOrBlank()) View.GONE else View.VISIBLE

        val archivo = File(PonTuPrecioRepository.carpeta(this), captura.imagen)
        val miniatura = item.findViewById<ImageView>(R.id.ivMiniaturaPonTuPrecio)
        if (archivo.exists()) {
            miniatura.setImageBitmap(decodificar(archivo, 240))
        } else {
            miniatura.setImageResource(R.drawable.ic_oferta)
        }

        item.findViewById<View>(R.id.btnVerPonTuPrecio).setOnClickListener {
            verCaptura(archivo)
        }
        item.findViewById<View>(R.id.btnRegistrarPonTuPrecio).setOnClickListener {
            PwaBridge.openApp(this)
        }
        item.findViewById<View>(R.id.btnEliminarPonTuPrecio).setOnClickListener {
            AlertDialog.Builder(this)
                .setMessage(R.string.pon_tu_precio_delete_confirm)
                .setPositiveButton(android.R.string.ok) { _, _ ->
                    PonTuPrecioRepository.eliminar(this, captura.ts, captura.precio)
                    cargar()
                }
                .setNegativeButton(android.R.string.cancel, null)
                .show()
        }
        return item
    }

    private fun verCaptura(archivo: File) {
        if (!archivo.exists()) return
        val imagen = ImageView(this).apply {
            setImageBitmap(decodificar(archivo, 1600))
            adjustViewBounds = true
            scaleType = ImageView.ScaleType.FIT_CENTER
        }
        AlertDialog.Builder(this)
            .setView(imagen)
            .setPositiveButton(android.R.string.ok, null)
            .show()
    }

    private fun confirmarLimpiar() {
        AlertDialog.Builder(this)
            .setMessage(R.string.pon_tu_precio_clear_confirm)
            .setPositiveButton(android.R.string.ok) { _, _ ->
                PonTuPrecioRepository.limpiar(this)
                cargar()
            }
            .setNegativeButton(android.R.string.cancel, null)
            .show()
    }

    private fun decodificar(archivo: File, maximo: Int): Bitmap? {
        val opciones = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeFile(archivo.absolutePath, opciones)
        var muestra = 1
        while (opciones.outWidth / muestra > maximo || opciones.outHeight / muestra > maximo) {
            muestra *= 2
        }
        return BitmapFactory.decodeFile(
            archivo.absolutePath,
            BitmapFactory.Options().apply { inSampleSize = muestra }
        )
    }

    private fun cop(valor: Long): String =
        "$" + String.format(Locale.US, "%,d", valor).replace(',', '.')

    private fun km(valor: Double): String =
        String.format(Locale.US, "%.1f", valor).replace('.', ',')
}
