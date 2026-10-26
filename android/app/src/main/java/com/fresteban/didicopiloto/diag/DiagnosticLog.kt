package com.fresteban.didicopiloto.diag

import android.content.Context
import android.content.Intent
import androidx.core.content.FileProvider
import com.fresteban.didicopiloto.offer.Decision
import com.fresteban.didicopiloto.offer.Offer
import org.json.JSONObject
import java.io.File

/**
 * Registro local de ofertas y notificaciones para calibrar el parser.
 * Nunca sale del teléfono salvo que el usuario lo comparta a mano.
 */
object DiagnosticLog {

    private const val ARCHIVO = "diagnostico.jsonl"

    fun archivo(context: Context): File = File(context.filesDir, ARCHIVO)

    @Synchronized
    fun append(
        context: Context,
        tipo: String,
        textos: List<String>,
        offer: Offer? = null,
        decision: Decision? = null
    ) {
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

        runCatching {
            archivo(context).appendText(json.toString() + "\n")
        }
    }

    fun shareIntent(context: Context): Intent? {
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
        runCatching { archivo(context).delete() }
    }
}
