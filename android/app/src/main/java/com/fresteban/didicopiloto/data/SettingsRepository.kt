package com.fresteban.didicopiloto.data

import android.content.Context

interface KeyValueStore {
    fun getInt(key: String, default: Int): Int
    fun getFloat(key: String, default: Float): Float
    fun getBoolean(key: String, default: Boolean): Boolean
    fun putInt(key: String, value: Int)
    fun putFloat(key: String, value: Float)
    fun putBoolean(key: String, value: Boolean)
}

class SharedPrefsStore(context: Context) : KeyValueStore {
    private val prefs = context.getSharedPreferences("didi_copiloto_settings", Context.MODE_PRIVATE)

    override fun getInt(key: String, default: Int): Int = prefs.getInt(key, default)
    override fun getFloat(key: String, default: Float): Float = prefs.getFloat(key, default)
    override fun getBoolean(key: String, default: Boolean): Boolean = prefs.getBoolean(key, default)
    override fun putInt(key: String, value: Int) = prefs.edit().putInt(key, value).apply()
    override fun putFloat(key: String, value: Float) = prefs.edit().putFloat(key, value).apply()
    override fun putBoolean(key: String, value: Boolean) = prefs.edit().putBoolean(key, value).apply()
}

class SettingsRepository(private val store: KeyValueStore) {

    fun load(): MetaConfig = MetaConfig(
        metaCopHora = store.getInt(KEY_META_HORA, 30_000),
        metaCopKm = store.getInt(KEY_META_KM, 2_000),
        precioGalonCOP = store.getInt(KEY_GALON, 16_000),
        rendimientoKmGalon = store.getFloat(KEY_RENDIMIENTO, 40f).toDouble(),
        viajeIncluyeRecogida = store.getBoolean(KEY_RECOGIDA, false)
    )

    fun save(config: MetaConfig) {
        store.putInt(KEY_META_HORA, config.metaCopHora)
        store.putInt(KEY_META_KM, config.metaCopKm)
        store.putInt(KEY_GALON, config.precioGalonCOP)
        store.putFloat(KEY_RENDIMIENTO, config.rendimientoKmGalon.toFloat())
        store.putBoolean(KEY_RECOGIDA, config.viajeIncluyeRecogida)
    }

    companion object {
        const val KEY_META_HORA = "meta_cop_hora"
        const val KEY_META_KM = "meta_cop_km"
        const val KEY_GALON = "precio_galon"
        const val KEY_RENDIMIENTO = "rendimiento_km_galon"
        const val KEY_RECOGIDA = "viaje_incluye_recogida"
    }
}
