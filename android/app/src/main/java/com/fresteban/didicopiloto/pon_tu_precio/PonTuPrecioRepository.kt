package com.fresteban.didicopiloto.pon_tu_precio

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import kotlin.math.abs

/** Guarda las ofertas individuales de "Pon tu precio" en el almacenamiento privado. */
object PonTuPrecioRepository {

    private const val ARCHIVO = "index.json"
    private const val CARPETA = "pon_tu_precio"
    private const val MAX = 50
    private const val VENTANA_FUSION_MS = 30 * 60 * 1000L

    fun carpeta(context: Context): File =
        File(context.applicationContext.filesDir, CARPETA).apply { mkdirs() }

    fun listar(context: Context): List<CapturaPonTuPrecio> = synchronized(this) {
        val archivo = File(carpeta(context), ARCHIVO)
        if (!archivo.exists()) return@synchronized emptyList()

        runCatching {
            val array = JSONArray(archivo.readText())
            (0 until array.length()).mapNotNull { indice ->
                val obj = array.optJSONObject(indice) ?: return@mapNotNull null
                CapturaPonTuPrecio(
                    ts = obj.optLong("ts"),
                    imagen = obj.optString("imagen"),
                    precio = obj.optLong("precio"),
                    minRecogida = enteroONull(obj, "minRecogida"),
                    kmRecogida = dobleONull(obj, "kmRecogida"),
                    minViaje = enteroONull(obj, "minViaje"),
                    kmViaje = dobleONull(obj, "kmViaje"),
                    copKm = dobleONull(obj, "copKm"),
                    copHora = dobleONull(obj, "copHora"),
                    semaforo = textoONull(obj, "semaforo"),
                    frase = textoONull(obj, "frase"),
                    texto = obj.optString("texto")
                )
            }
        }.getOrDefault(emptyList())
    }

    /**
     * Agrega ofertas individuales. Si la misma oferta ya existe (mismo precio,
     * menos de 30 min), actualiza sus datos en vez de duplicarla.
     */
    fun agregar(context: Context, nuevas: List<CapturaPonTuPrecio>) = synchronized(this) {
        if (nuevas.isEmpty()) return@synchronized

        val lista = listar(context).toMutableList()
        nuevas.forEach { nueva ->
            val indice = lista.indexOfFirst {
                it.precio == nueva.precio && abs(it.ts - nueva.ts) < VENTANA_FUSION_MS
            }

            if (indice >= 0) {
                val existente = lista[indice]
                lista[indice] =
                    if (existente.completa && !nueva.completa) {
                        // No perder el análisis ya calculado si esta captura vino incompleta.
                        existente.copy(ts = nueva.ts, imagen = nueva.imagen, texto = nueva.texto)
                    } else {
                        nueva
                    }
            } else {
                lista.add(0, nueva)
            }
        }

        val conservadas = lista.take(MAX)
        val imagenesUsadas = conservadas.map { it.imagen }.toSet()
        carpeta(context).listFiles()
            ?.filter { it.isFile && it.name.endsWith(".jpg") && it.name !in imagenesUsadas }
            ?.forEach { it.delete() }

        escribir(context, conservadas)
    }

    fun eliminar(context: Context, ts: Long, precio: Long) = synchronized(this) {
        val lista = listar(context)
        val aBorrar = lista.firstOrNull { it.ts == ts && it.precio == precio }
        val restantes = lista.filterNot { it.ts == ts && it.precio == precio }

        aBorrar?.let { captura ->
            val imagenSigueUsada = restantes.any { it.imagen == captura.imagen }
            if (!imagenSigueUsada) {
                File(carpeta(context), captura.imagen).delete()
            }
        }

        escribir(context, restantes)
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
                    put("precio", captura.precio)
                    put("minRecogida", captura.minRecogida ?: JSONObject.NULL)
                    put("kmRecogida", captura.kmRecogida ?: JSONObject.NULL)
                    put("minViaje", captura.minViaje ?: JSONObject.NULL)
                    put("kmViaje", captura.kmViaje ?: JSONObject.NULL)
                    put("copKm", captura.copKm ?: JSONObject.NULL)
                    put("copHora", captura.copHora ?: JSONObject.NULL)
                    put("semaforo", captura.semaforo ?: JSONObject.NULL)
                    put("frase", captura.frase ?: JSONObject.NULL)
                    put("texto", captura.texto)
                }
            )
        }
        File(carpeta(context), ARCHIVO).writeText(array.toString())
    }

    private fun enteroONull(obj: JSONObject, clave: String): Int? =
        if (obj.isNull(clave)) null else obj.optInt(clave)

    private fun dobleONull(obj: JSONObject, clave: String): Double? =
        if (obj.isNull(clave)) null else obj.optDouble(clave)

    private fun textoONull(obj: JSONObject, clave: String): String? =
        if (obj.isNull(clave)) null else obj.optString(clave).takeIf { it.isNotBlank() }
}
