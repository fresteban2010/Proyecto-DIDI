package com.fresteban.didicopiloto.diag

import android.content.Context
import android.content.Intent
import androidx.core.content.FileProvider
import com.fresteban.didicopiloto.offer.Decision
import com.fresteban.didicopiloto.offer.Offer
import org.json.JSONObject
import java.io.File
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

/**
 * Registro local de ofertas y notificaciones para calibrar el parser.
 * Nunca sale del teléfono salvo que el usuario lo comparta a mano.
 * La escritura ocurre fuera del hilo principal y el archivo rota a los 2 MB.
 */
object DiagnosticLog {

    private const val CARPETA = "diagnostico"
    private const val ARCHIVO = "diagnostico.jsonl"
    private const val MAX_BYTES = 2L * 1024 * 1024

    private val escritor = Executors.newSingleThreadExecutor()

    fun archivo(context: Context): File =
        File(File(context.applicationContext.filesDir, CARPETA), ARCHIVO)

    fun append(
        context: Context,
        tipo: String,
        textos: List<String>,
        offer: Offer? = null,
        decision: Decision? = null
    ) {
        val appContext = context.applicationContext
        val json = JSONObject()
            .put("ts", System.currentTimeMillis())
            .put("tipo", tipo)
            .put("textos", textos.joinToString(" | "))

        offer?.let {
            json.put("precio", it.precioCOP)
            json.put("kmRecogida", it.kmRecogida)
            json.put("minRecogida", it.minRecogida)
            json.put("kmViaje", it.kmViaje)
            json.put("minViaje", it.minViaje)
            json.put("metodo", it.metodoPago)
        }
        decision?.let {
            json.put("copKm", it.copKm)
            json.put("copHora", it.copHora)
            json.put("semaforo", it.semaforo.name)
            json.put("frase", it.frase)
        }

        escritor.execute {
            synchronized(this) {
                runCatching {
                    val file = archivo(appContext)
                    file.parentFile?.mkdirs()
                    if (file.length() > MAX_BYTES) {
                        val viejo = File(file.parentFile, "$ARCHIVO.1")
                        viejo.delete()
                        file.renameTo(viejo)
                    }
                    file.appendText(json.toString() + "\n")
                }
            }
        }
    }

    /** Espera a que se vacíen las escrituras pendientes antes de compartir. */
    fun flush() {
        runCatching { escritor.submit { }.get(1, TimeUnit.SECONDS) }
    }

    fun shareIntent(context: Context): Intent? {
        flush()
        val file = archivo(context)
        if (!file.exists() || file.length() == 0L) return null

        val uri = FileProvider.getUriForFile(
            context,
            "${context.packageName}.fileprovider",
            file
        )

        return Intent(Intent.ACTION_SEND).apply {
            type = "text/plain"
            putExtra(Intent.EXTRA_SUBJECT, "Diagnóstico DIDI Copiloto")
            putExtra(Intent.EXTRA_STREAM, uri)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
    }

    fun clear(context: Context) {
        escritor.execute {
            synchronized(this) {
                runCatching {
                    archivo(context).delete()
                    File(archivo(context).parentFile, "$ARCHIVO.1").delete()
                }
            }
        }
    }
}
