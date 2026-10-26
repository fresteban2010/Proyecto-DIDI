package com.fresteban.didicopiloto.offer

import android.graphics.Bitmap
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions

/**
 * OCR on-device con ML Kit. Se usa cuando DiDi no expone el texto al árbol
 * de accesibilidad (la oferta se dibuja en un FrameLayout sin nodos).
 */
class OfferOcr {

    private val reconocedor = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)

    fun reconocer(
        bitmap: Bitmap,
        onSuccess: (List<String>) -> Unit,
        onError: (Exception) -> Unit
    ) {
        val imagen = InputImage.fromBitmap(bitmap, 0)
        reconocedor.process(imagen)
            .addOnSuccessListener { texto ->
                val lineas = texto.textBlocks.flatMap { bloque ->
                    bloque.lines.map { it.text }
                }.filter { it.isNotBlank() }
                onSuccess(lineas)
            }
            .addOnFailureListener { error -> onError(error) }
    }

    fun cerrar() {
        reconocedor.close()
    }
}
