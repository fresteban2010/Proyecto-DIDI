package com.fresteban.didicopiloto.offer

import android.graphics.Bitmap
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions

/** Línea de OCR con su posición en la captura, para recortar cada tarjeta. */
data class LineaOcr(
    val texto: String,
    val top: Int,
    val bottom: Int,
    val left: Int,
    val right: Int
)

/**
 * OCR on-device con ML Kit. Se usa cuando DiDi no expone el texto al árbol
 * de accesibilidad (la oferta se dibuja en un FrameLayout sin nodos).
 */
class OfferOcr {

    private val reconocedor = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)

    fun reconocer(
        bitmap: Bitmap,
        onSuccess: (List<LineaOcr>) -> Unit,
        onError: (Exception) -> Unit
    ) {
        val imagen = InputImage.fromBitmap(bitmap, 0)
        reconocedor.process(imagen)
            .addOnSuccessListener { texto ->
                val lineas = texto.textBlocks.flatMap { bloque ->
                    bloque.lines.mapNotNull { linea ->
                        val caja = linea.boundingBox ?: return@mapNotNull null
                        LineaOcr(
                            texto = linea.text,
                            top = caja.top,
                            bottom = caja.bottom,
                            left = caja.left,
                            right = caja.right
                        )
                    }
                }.filter { it.texto.isNotBlank() }
                onSuccess(lineas)
            }
            .addOnFailureListener { error -> onError(error) }
    }

    fun cerrar() {
        reconocedor.close()
    }
}
