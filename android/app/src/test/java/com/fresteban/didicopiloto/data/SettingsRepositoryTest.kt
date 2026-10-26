package com.fresteban.didicopiloto.data

import org.junit.Assert.assertEquals
import org.junit.Test

class SettingsRepositoryTest {

    private class MapStore : KeyValueStore {
        private val map = mutableMapOf<String, Any>()
        override fun getInt(key: String, default: Int): Int = map[key] as? Int ?: default
        override fun getFloat(key: String, default: Float): Float = map[key] as? Float ?: default
        override fun getBoolean(key: String, default: Boolean): Boolean = map[key] as? Boolean ?: default
        override fun putInt(key: String, value: Int) { map[key] = value }
        override fun putFloat(key: String, value: Float) { map[key] = value }
        override fun putBoolean(key: String, value: Boolean) { map[key] = value }
    }

    @Test
    fun `devuelve los valores por defecto`() {
        val repo = SettingsRepository(MapStore())
        val config = repo.load()

        assertEquals(30_000, config.metaCopHora)
        assertEquals(2_000, config.metaCopKm)
        assertEquals(16_000, config.precioGalonCOP)
        assertEquals(40.0, config.rendimientoKmGalon, 0.001)
        assertEquals(false, config.viajeIncluyeRecogida)
    }

    @Test
    fun `una configuracion corrupta vuelve a los valores por defecto`() {
        val store = MapStore().apply {
            putInt(SettingsRepository.KEY_META_HORA, 0)
            putInt(SettingsRepository.KEY_META_KM, -1)
            putFloat(SettingsRepository.KEY_RENDIMIENTO, 0f)
        }

        val config = SettingsRepository(store).load()

        assertEquals(30_000, config.metaCopHora)
        assertEquals(2_000, config.metaCopKm)
        assertEquals(40.0, config.rendimientoKmGalon, 0.001)
    }

    @Test
    fun `guarda y relee la configuracion`() {
        val repo = SettingsRepository(MapStore())
        val original = MetaConfig(
            metaCopHora = 35_000,
            metaCopKm = 2_200,
            precioGalonCOP = 17_500,
            rendimientoKmGalon = 42.5,
            viajeIncluyeRecogida = true
        )

        repo.save(original)

        assertEquals(original, repo.load())
    }
}
