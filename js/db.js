/**
 * DIDI TRACKER - Capa de persistencia IndexedDB (db.js)
 * Base de datos: DidiTrackerDB (v1)
 * Almacenes: jornadas, viajes, tanqueadas, gastosPuntuales, config
 *
 * Expone un objeto global `DidiDB` con operaciones promisificadas.
 * IndexedDB es la fuente de la verdad; localStorage se conserva como
 * respaldo espejo y para migración transparente de versiones anteriores.
 */

const DidiDB = (() => {
  const DB_NAME = 'DidiTrackerDB';
  const DB_VERSION = 1;
  const STORES = ['jornadas', 'viajes', 'tanqueadas', 'gastosPuntuales', 'config'];

  let dbPromise = null;

  function abrir() {
    if (dbPromise) return dbPromise;

    dbPromise = new Promise((resolve, reject) => {
      if (!window.indexedDB) {
        reject(new Error('IndexedDB no está disponible en este navegador.'));
        return;
      }

      const solicitud = indexedDB.open(DB_NAME, DB_VERSION);

      solicitud.onupgradeneeded = evento => {
        const db = evento.target.result;

        if (!db.objectStoreNames.contains('jornadas')) {
          db.createObjectStore('jornadas', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('viajes')) {
          const store = db.createObjectStore('viajes', { keyPath: 'id' });
          store.createIndex('jornadaId', 'jornadaId', { unique: false });
        }
        if (!db.objectStoreNames.contains('tanqueadas')) {
          const store = db.createObjectStore('tanqueadas', { keyPath: 'id' });
          store.createIndex('jornadaId', 'jornadaId', { unique: false });
        }
        if (!db.objectStoreNames.contains('gastosPuntuales')) {
          const store = db.createObjectStore('gastosPuntuales', { keyPath: 'id' });
          store.createIndex('jornadaId', 'jornadaId', { unique: false });
        }
        if (!db.objectStoreNames.contains('config')) {
          db.createObjectStore('config', { keyPath: 'clave' });
        }
      };

      solicitud.onsuccess = () => resolve(solicitud.result);
      solicitud.onerror = () => reject(solicitud.error || new Error('No se pudo abrir IndexedDB.'));
      solicitud.onblocked = () => reject(new Error('IndexedDB bloqueada por otra pestaña abierta.'));
    });

    return dbPromise;
  }

  function promesaDeSolicitud(solicitud) {
    return new Promise((resolve, reject) => {
      solicitud.onsuccess = () => resolve(solicitud.result);
      solicitud.onerror = () => reject(solicitud.error);
    });
  }

  function promesaDeTransaccion(transaccion) {
    return new Promise((resolve, reject) => {
      transaccion.oncomplete = () => resolve();
      transaccion.onerror = () => reject(transaccion.error);
      transaccion.onabort = () => reject(transaccion.error || new Error('Transacción abortada.'));
    });
  }

  async function obtenerTodos(store) {
    const db = await abrir();
    return promesaDeSolicitud(db.transaction(store, 'readonly').objectStore(store).getAll());
  }

  async function contar(store) {
    const db = await abrir();
    return promesaDeSolicitud(db.transaction(store, 'readonly').objectStore(store).count());
  }

  async function contarRegistros() {
    const [jornadas, viajes, tanqueadas, gastosPuntuales] = await Promise.all([
      contar('jornadas'),
      contar('viajes'),
      contar('tanqueadas'),
      contar('gastosPuntuales')
    ]);
    return { jornadas, viajes, tanqueadas, gastosPuntuales };
  }

  async function obtenerJornadaActiva() {
    const jornadas = await obtenerTodos('jornadas');
    return (
      jornadas
        .filter(j => j.estado === 'activa')
        .sort((a, b) => String(b.fechaInicio || '').localeCompare(String(a.fechaInicio || '')))[0] || null
    );
  }

  async function obtenerPorJornada(store, jornadaId) {
    const db = await abrir();
    const indice = db.transaction(store, 'readonly').objectStore(store).index('jornadaId');
    return promesaDeSolicitud(indice.getAll(IDBKeyRange.only(jornadaId)));
  }

  async function obtenerConfig() {
    const entradas = await obtenerTodos('config');
    const config = {};
    entradas.forEach(entrada => {
      config[entrada.clave] = entrada.valor;
    });
    return config;
  }

  async function guardarConfig(configObj) {
    const db = await abrir();
    const transaccion = db.transaction('config', 'readwrite');
    const store = transaccion.objectStore('config');
    Object.entries(configObj || {}).forEach(([clave, valor]) => store.put({ clave, valor }));
    await promesaDeTransaccion(transaccion);
  }

  /**
   * Guarda/actualiza una jornada con sus viajes y tanqueadas.
   * Reemplaza los registros hijos de esa jornada (upsert limpio).
   * Los objetos recibidos ya vienen con métricas calculadas desde app.js.
   */
  async function guardarJornada(jornada, viajes = [], tanqueadas = []) {
    const db = await abrir();

    // 1) Leer claves existentes de la jornada (lectura previa)
    const txLectura = db.transaction(['viajes', 'tanqueadas'], 'readonly');
    const clavesViajes = await promesaDeSolicitud(
      txLectura.objectStore('viajes').index('jornadaId').getAllKeys(IDBKeyRange.only(jornada.id))
    );
    const clavesTanqueadas = await promesaDeSolicitud(
      txLectura.objectStore('tanqueadas').index('jornadaId').getAllKeys(IDBKeyRange.only(jornada.id))
    );

    // 2) Escritura: primero borrar las claves antiguas, luego insertar
    const transaccion = db.transaction(['jornadas', 'viajes', 'tanqueadas'], 'readwrite');
    transaccion.objectStore('jornadas').put(jornada);

    const storeViajes = transaccion.objectStore('viajes');
    clavesViajes.forEach(clave => storeViajes.delete(clave));
    viajes.forEach(viaje => storeViajes.put({ ...viaje, jornadaId: jornada.id }));

    const storeTanqueadas = transaccion.objectStore('tanqueadas');
    clavesTanqueadas.forEach(clave => storeTanqueadas.delete(clave));
    tanqueadas.forEach(tanqueada => storeTanqueadas.put({ ...tanqueada, jornadaId: jornada.id }));

    await promesaDeTransaccion(transaccion);
  }

  /**
   * Exporta la base completa como objeto serializable (respaldo JSON).
   */
  async function exportarTodo() {
    const [jornadas, viajes, tanqueadas, gastosPuntuales, config] = await Promise.all(
      STORES.map(obtenerTodos)
    );
    return {
      app: 'DIDI Pro',
      schema: DB_VERSION,
      exportadoEn: new Date().toISOString(),
      jornadas,
      viajes,
      tanqueadas,
      gastosPuntuales,
      config
    };
  }

  function validarRespaldo(datos) {
    if (!datos || typeof datos !== 'object') {
      throw new Error('El archivo no contiene un respaldo válido.');
    }
    STORES.forEach(campo => {
      if (!Array.isArray(datos[campo])) {
        throw new Error(`Respaldo incompleto: falta la sección "${campo}".`);
      }
    });
    if (datos.schema !== undefined && Number(datos.schema) !== DB_VERSION) {
      throw new Error(`Versión de respaldo no soportada (schema ${datos.schema}).`);
    }
  }

  /**
   * Restaura una base completa desde un objeto de respaldo validado.
   * Reemplaza por completo el contenido de los 5 almacenes (transaccional).
   */
  async function importarTodo(datos) {
    validarRespaldo(datos);
    const db = await abrir();
    const transaccion = db.transaction(STORES, 'readwrite');

    STORES.forEach(store => transaccion.objectStore(store).clear());
    datos.jornadas.forEach(item => transaccion.objectStore('jornadas').put(item));
    datos.viajes.forEach(item => transaccion.objectStore('viajes').put(item));
    datos.tanqueadas.forEach(item => transaccion.objectStore('tanqueadas').put(item));
    datos.gastosPuntuales.forEach(item => transaccion.objectStore('gastosPuntuales').put(item));
    datos.config.forEach(item => transaccion.objectStore('config').put(item));

    await promesaDeTransaccion(transaccion);

    return {
      jornadas: datos.jornadas.length,
      viajes: datos.viajes.length,
      tanqueadas: datos.tanqueadas.length,
      gastosPuntuales: datos.gastosPuntuales.length,
      config: datos.config.length
    };
  }

  return {
    STORES,
    abrir,
    obtenerTodos,
    contarRegistros,
    obtenerJornadaActiva,
    obtenerViajesDeJornada: jornadaId => obtenerPorJornada('viajes', jornadaId),
    obtenerTanqueadasDeJornada: jornadaId => obtenerPorJornada('tanqueadas', jornadaId),
    obtenerConfig,
    guardarConfig,
    guardarJornada,
    exportarTodo,
    importarTodo,
    validarRespaldo
  };
})();
