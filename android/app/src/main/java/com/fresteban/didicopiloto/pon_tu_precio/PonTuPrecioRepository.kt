package com.fresteban.didicopiloto.pon_tu_precio

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

/** Guarda las capturas de la lista de solicitudes en el almacenamiento privado. */
object PonTuPrecioRepository {

    private const val ARCHIVO = "index.json"
    private const val CARPETA = "pon_tu_precio"
    private const val MAX = 50

    fun carpeta(context: Context): File =
        File(context.applicationContext.filesDir, CARPETA).apply { mkdirs() }

    fun listar(context: Context): List<CapturaPonTuPrecio> = synchronized(this) {
        val archivo = File(carpeta(context), ARCHIVO)
        if (!archivo.exists()) return@synchronized emptyList()

        runCatching {
            val array = JSONArray(archivo.readText())
            (0 until array.length()).mapNotNull { indice ->
                val obj = array.optJSONObject(indice) ?: return@mapNotNull null
                val imagen = obj.optString("imagen")
                val ruta = File(carpeta(context), imagen)
                if (imagen.isBlank() || !ruta.exists()) return@mapNotNull null

                val preciosArray = obj.optJSONArray("precios") ?: JSONArray()
                val tramosArray = obj.optJSONArray("tramos") ?: JSONArray()
                CapturaPonTuPrecio(
                    ts = obj.optLong("ts"),
                    imagen = imagen,
                    precios = (0 until preciosArray.length()).map { preciosArray.optLong(it) },
                    tramos = (0 until tramosArray.length()).map { tramosArray.optString(it) },
                    texto = obj.optString("texto")
                )
            }
        }.getOrDefault(emptyList())
    }

    fun agregar(context: Context, captura: CapturaPonTuPrecio) = synchronized(this) {
        val lista = listar(context).filterNot { it.ts == captura.ts }.toMutableList()
        lista.add(0, captura)

        lista.drop(MAX).forEach { File(carpeta(context), it.imagen).delete() }
        escribir(context, lista.take(MAX))
    }

    fun eliminar(context: Context, ts: Long) = synchronized(this) {
        val lista = listar(context)
        lista.firstOrNull { it.ts == ts }?.let {
            File(carpeta(context), it.imagen).delete()
        }
        escribir(context, lista.filterNot { it.ts == ts })
    }

    fun limpiar(context: Context) = synchronized(this) {
        carpeta(context).listFiles()?.forEach { it.delete() }
    }

    private fun escribir(context: Context, lista: List<CapturaPonTuPrecio>) {
        val array = JSONArray()
        lista.forEach { captura ->
            array.put(
                JSONObject().apply {
                    put("ts", captura.ts)
                    put("imagen", captura.imagen)
                    put("precios", JSONArray(captura.precios))
                    put("tramos", JSONArray(captura.tramos))
                    put("texto", captura.texto)
                }
            )
        }
        File(carpeta(context), ARCHIVO).writeText(array.toString())
    }
}
