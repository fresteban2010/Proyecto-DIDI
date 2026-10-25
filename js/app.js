/**
 * DIDI TRACKER - Lógica Principal de la Aplicación (app.js)
 * Gestión de viajes, métricas de rentabilidad, combustible, gráficos y persistencia.
 */

const STORAGE_KEY = 'didi_tracker_data';

// Logo oficial: tacómetro vintage de auto clásico de los 80 (PNG)
const BRAND_LOGO_SVG = `
  <img src="assets/icons/logo-tacometro.png" alt="DIDI Tracker" width="44" height="44" />
`.trim();

// Configuración por defecto solicitada
const DEFAULT_CONFIG = {
  metaHora: 30000,
  metaKm: 2000,
  rendimientoGalonKm: 40,
  precioGalonCOP: 16000,
  metaDiaria: 150000,
  tarifaMinimaBonus: 8500,
  audioSilenciado: false,
  costoAceiteCOP: 200000,
  intervaloAceiteKm: 5000
};

// Estado global de la aplicación
let appData = {
  config: { ...DEFAULT_CONFIG },
  sesionActual: {
    fechaInicio: new Date().toISOString(),
    viajes: [],
    tanqueadas: []
  }
};

// Instancias globales de Chart.js
let chartPagosInstance = null;
let chartCarrerasInstance = null;

// ==========================================
// 1. UTILIDADES DE FORMATO
// ==========================================

const copFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
  minimumFractionDigits: 0
});

function formatCOP(valor) {
  const num = Number(valor) || 0;
  return copFormatter.format(Math.round(num));
}

function formatNum(valor, decimales = 1) {
  const num = Number(valor) || 0;
  return num.toLocaleString('es-CO', {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales
  });
}

function formatDuracion(minutosTotales) {
  const min = Math.round(Number(minutosTotales) || 0);
  if (min < 60) return `${min} min`;
  const horas = Math.floor(min / 60);
  const restoMin = min % 60;
  return restoMin > 0 ? `${horas}h ${restoMin}m` : `${horas}h`;
}

function formatFechaHora(isoString) {
  if (!isoString) return '--:--';
  const fecha = new Date(isoString);
  if (isNaN(fecha.getTime())) return '--:--';
  return fecha.toLocaleTimeString('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

function formatFechaCompleta(isoString) {
  if (!isoString) return '';
  const fecha = new Date(isoString);
  if (isNaN(fecha.getTime())) return '';
  return fecha.toLocaleDateString('es-CO', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function generarId() {
  return 'id_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 7);
}

// ==========================================
// 2. PERSISTENCIA LOCAL-FIRST (INDEXEDDB + ESPEJO LOCALSTORAGE)
// ==========================================

/**
 * Carga la jornada activa desde IndexedDB (fuente de la verdad).
 * Si la base está vacía y existen datos de la versión anterior en
 * localStorage, se migran de forma transparente sin pérdida de datos.
 * Si IndexedDB falla, se usa localStorage como respaldo.
 */
async function cargarDatos() {
  try {
    await DidiDB.contarRegistros(); // fuerza apertura/creación de DidiTrackerDB
    await migrarDesdeLocalStorageSiHaceFalta();

    const jornada = await DidiDB.obtenerJornadaActiva();
    if (jornada) {
      const [viajes, tanqueadas, gastos, config] = await Promise.all([
        DidiDB.obtenerViajesDeJornada(jornada.id),
        DidiDB.obtenerTanqueadasDeJornada(jornada.id),
        DidiDB.obtenerGastosDeJornada(jornada.id),
        DidiDB.obtenerConfig()
      ]);

      appData = {
        config: {
          ...DEFAULT_CONFIG,
          ...config
        },
        sesionActual: {
          id: jornada.id,
          fechaInicio: jornada.fechaInicio || new Date().toISOString(),
          fechaFin: jornada.fechaFin || null,
          estado: jornada.estado || 'activa',
          resumen: jornada.resumen || null,
          viajes: (Array.isArray(viajes) ? viajes : []).map(normalizarViajeDesdeDB),
          tanqueadas: Array.isArray(tanqueadas) ? tanqueadas : [],
          gastos: Array.isArray(gastos) ? gastos : []
        }
      };
      return;
    }

    // Sin jornada activa en la base: intentar el espejo de localStorage
    cargarDesdeLocalStorage();
  } catch (error) {
    console.warn('DIDI Tracker: IndexedDB no disponible, usando localStorage:', error.message);
    cargarDesdeLocalStorage();
  }
}

/**
 * Repara registros antiguos de IndexedDB que solo guardaban dTotal/tTotal:
 * sin los campos de detalle, recalcular COP/h daría 0 tras una recarga.
 */
function normalizarViajeDesdeDB(viaje) {
  const tieneDetalle =
    Object.prototype.hasOwnProperty.call(viaje, 'tiempoEntregaMin') ||
    Object.prototype.hasOwnProperty.call(viaje, 'tiempoRecogidaMin');

  return {
    ...viaje,
    distRecogidaKm: Number(viaje.distRecogidaKm) || 0,
    tiempoRecogidaMin: Number(viaje.tiempoRecogidaMin) || 0,
    distEntregaKm: Number(viaje.distEntregaKm) || Number(viaje.dTotal) || 0,
    tiempoEntregaMin: tieneDetalle
      ? Number(viaje.tiempoEntregaMin) || 0
      : Number(viaje.tTotal) || 0
  };
}

function cargarDesdeLocalStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      inicializarDatosPorDefecto();
      return;
    }
    const parsed = JSON.parse(raw);

    appData = {
      config: {
        ...DEFAULT_CONFIG,
        ...(parsed.config || {})
      },
      sesionActual: {
        id: parsed.sesionActual?.id || generarId(),
        fechaInicio: parsed.sesionActual?.fechaInicio || new Date().toISOString(),
        fechaFin: parsed.sesionActual?.fechaFin || null,
        estado: parsed.sesionActual?.estado || 'activa',
        resumen: parsed.sesionActual?.resumen || null,
        viajes: Array.isArray(parsed.sesionActual?.viajes) ? parsed.sesionActual.viajes : [],
        tanqueadas: Array.isArray(parsed.sesionActual?.tanqueadas) ? parsed.sesionActual.tanqueadas : [],
        gastos: Array.isArray(parsed.sesionActual?.gastos) ? parsed.sesionActual.gastos : []
      }
    };
  } catch (error) {
    console.error('Error al cargar datos de localStorage, restaurando valores por defecto:', error);
    inicializarDatosPorDefecto();
  }
}

function inicializarDatosPorDefecto() {
  appData = {
    config: { ...DEFAULT_CONFIG },
    sesionActual: {
      id: generarId(),
      fechaInicio: new Date().toISOString(),
      fechaFin: null,
      estado: 'activa',
      resumen: null,
      viajes: [],
      tanqueadas: [],
      gastos: []
    }
  };
  guardarDatos();
}

/**
 * Migración transparente: si DidiTrackerDB no tiene jornadas pero existe
 * la clave antigua `didi_tracker_data` en localStorage, se importa todo.
 */
async function migrarDesdeLocalStorageSiHaceFalta() {
  const conteo = await DidiDB.contarRegistros();
  if (conteo.jornadas > 0) return false;

  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return false;

  try {
    const parsed = JSON.parse(raw);
    const sesion = parsed.sesionActual || {};
    const config = { ...DEFAULT_CONFIG, ...(parsed.config || {}) };
    const fechaInicio = sesion.fechaInicio || new Date().toISOString();
    const jornadaId =
      sesion.id || `jornada_${new Date(fechaInicio).getTime().toString(36)}`;

    const viajes = (Array.isArray(sesion.viajes) ? sesion.viajes : []).map(viaje => {
      const metricas = calcularMetricasViaje(viaje, config);
      return {
        id: metricas.id,
        timestamp: metricas.timestamp,
        distRecogidaKm: metricas.distRecogidaKm,
        tiempoRecogidaMin: metricas.tiempoRecogidaMin,
        distEntregaKm: metricas.distEntregaKm,
        tiempoEntregaMin: metricas.tiempoEntregaMin,
        dTotal: metricas.dTotal,
        tTotal: metricas.tTotal,
        precioCOP: metricas.precioCOP,
        metodoPago: metricas.metodoPago,
        copHora: metricas.copHora,
        copKm: metricas.copKm,
        semaforo: metricas.semaforo
      };
    });

    const tanqueadas = (Array.isArray(sesion.tanqueadas) ? sesion.tanqueadas : []).map(t => ({
      id: t.id,
      timestamp: t.timestamp,
      montoCOP: t.montoCOP,
      galones: t.galones,
      nota: t.nota
    }));

    await DidiDB.guardarJornada(
      { id: jornadaId, fechaInicio, fechaFin: null, estado: 'activa', resumen: null },
      viajes,
      tanqueadas,
      []
    );
    await DidiDB.guardarConfig(config);

    console.info(
      `DIDI Tracker: migrados ${viajes.length} viajes y ${tanqueadas.length} tanqueadas a IndexedDB.`
    );
    return true;
  } catch (error) {
    console.warn('DIDI Tracker: falló la migración a IndexedDB:', error.message);
    return false;
  }
}

function guardarDatos() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
  } catch (error) {
    console.error('Error al guardar en localStorage:', error);
  }
  return persistirEnIndexedDB();
}

/**
 * Persiste la jornada activa completa en IndexedDB.
 * Devuelve la promesa para poder esperar el flush antes de exportar.
 */
function persistirEnIndexedDB() {
  if (typeof DidiDB === 'undefined' || !appData.sesionActual?.id) return null;

  const jornadaId = appData.sesionActual.id;

  const viajes = appData.sesionActual.viajes.map(viaje => {
    const metricas = calcularMetricasViaje(viaje);
    return {
      id: metricas.id,
      timestamp: metricas.timestamp,
      distRecogidaKm: metricas.distRecogidaKm,
      tiempoRecogidaMin: metricas.tiempoRecogidaMin,
      distEntregaKm: metricas.distEntregaKm,
      tiempoEntregaMin: metricas.tiempoEntregaMin,
      dTotal: metricas.dTotal,
      tTotal: metricas.tTotal,
      precioCOP: metricas.precioCOP,
      metodoPago: metricas.metodoPago,
      copHora: metricas.copHora,
      copKm: metricas.copKm,
      semaforo: metricas.semaforo
    };
  });

  const tanqueadas = appData.sesionActual.tanqueadas.map(t => ({
    id: t.id,
    timestamp: t.timestamp,
    montoCOP: t.montoCOP,
    galones: t.galones,
    nota: t.nota
  }));

  const gastos = (appData.sesionActual.gastos || []).map(g => ({
    id: g.id,
    timestamp: g.timestamp,
    tipo: g.tipo,
    montoCOP: g.montoCOP,
    odometro: g.odometro ?? null,
    nota: g.nota
  }));

  const jornada = {
    id: jornadaId,
    fechaInicio: appData.sesionActual.fechaInicio,
    fechaFin: appData.sesionActual.fechaFin || null,
    estado: appData.sesionActual.estado || 'activa',
    resumen: appData.sesionActual.resumen || null
  };

  return DidiDB.guardarJornada(jornada, viajes, tanqueadas, gastos)
    .then(() => DidiDB.guardarConfig(appData.config))
    .then(() => {
      actualizarEstadoAlmacenamiento();
    })
    .catch(error => {
      console.warn('DIDI Tracker: no se pudo guardar en IndexedDB:', error.message);
    });
}

// ==========================================
// 3. FUNCIONES DE CÁLCULO
// ==========================================

/**
 * Calcula las métricas individuales de un viaje y su clasificación en semáforo.
 * - D_total = distRecogidaKm + distEntregaKm
 * - T_total = tiempoRecogidaMin + tiempoEntregaMin
 * - COP/h = precioCOP / (T_total / 60)
 * - COP/km = precioCOP / D_total
 */
function calcularMetricasViaje(viaje, config = appData.config) {
  const distRecogidaKm = Math.max(0, Number(viaje.distRecogidaKm) || 0);
  const tiempoRecogidaMin = Math.max(0, Number(viaje.tiempoRecogidaMin) || 0);
  const distEntregaKm = Math.max(0, Number(viaje.distEntregaKm) || 0);
  const tiempoEntregaMin = Math.max(0, Number(viaje.tiempoEntregaMin) || 0);
  const precioCOP = Math.max(0, Number(viaje.precioCOP) || 0);

  const dTotal = distRecogidaKm + distEntregaKm;
  const tTotal = tiempoRecogidaMin + tiempoEntregaMin;

  const copHora = tTotal > 0 ? precioCOP / (tTotal / 60) : 0;
  const copKm = dTotal > 0 ? precioCOP / dTotal : 0;

  const metaHora = Number(config.metaHora) || 30000;
  const metaKm = Number(config.metaKm) || 2000;

  const cumpleHora = copHora >= metaHora;
  const cumpleKm = copKm >= metaKm;
  const casiCumpleHora = copHora >= metaHora * 0.8;
  const casiCumpleKm = copKm >= metaKm * 0.8;

  let semaforo = 'rojo';
  let etiquetaSemaforo = 'No Rentable';

  if (cumpleHora && cumpleKm) {
    semaforo = 'verde';
    etiquetaSemaforo = 'Excelente';
  } else if (cumpleHora || cumpleKm || (casiCumpleHora && casiCumpleKm)) {
    semaforo = 'amarillo';
    etiquetaSemaforo = 'Aceptable';
  }

  // Gasto estimado de gasolina para este viaje (400 COP/km por defecto)
  const costoKmGasolina = (config.precioGalonCOP || 16000) / (config.rendimientoGalonKm || 40);
  const gastoGasolinaViaje = dTotal * costoKmGasolina;
  const gananciaNetaViaje = precioCOP - gastoGasolinaViaje;

  return {
    ...viaje,
    distRecogidaKm,
    tiempoRecogidaMin,
    distEntregaKm,
    tiempoEntregaMin,
    precioCOP,
    dTotal,
    tTotal,
    copHora,
    copKm,
    semaforo,
    etiquetaSemaforo,
    gastoGasolinaViaje,
    gananciaNetaViaje
  };
}

/**
 * Calcula todos los acumulados, promedios, proyecciones y métricas de gasolina de la sesión.
 */
function calcularResumenSesion(
  viajes = appData.sesionActual.viajes,
  config = appData.config,
  tanqueadas = appData.sesionActual.tanqueadas,
  gastos = appData.sesionActual.gastos || []
) {
  const viajesCalculados = viajes.map(v => calcularMetricasViaje(v, config));

  let totalGanado = 0;
  let tiempoTotalMin = 0;
  let distanciaTotalKm = 0;
  let totalEfectivo = 0;
  let totalTarjeta = 0;
  let cantEfectivo = 0;
  let cantTarjeta = 0;

  viajesCalculados.forEach(v => {
    totalGanado += v.precioCOP;
    tiempoTotalMin += v.tTotal;
    distanciaTotalKm += v.dTotal;

    const metodoNorm = String(v.metodoPago || 'Efectivo').toLowerCase();
    if (metodoNorm.includes('tarjeta') || metodoNorm.includes('nequi') || metodoNorm.includes('digital')) {
      totalTarjeta += v.precioCOP;
      cantTarjeta++;
    } else {
      totalEfectivo += v.precioCOP;
      cantEfectivo++;
    }
  });

  const promHora = tiempoTotalMin > 0 ? totalGanado / (tiempoTotalMin / 60) : 0;
  const promKm = distanciaTotalKm > 0 ? totalGanado / distanciaTotalKm : 0;

  // Meta y proyección
  const metaDiaria = Math.max(0, Number(config.metaDiaria) || 150000);
  const porcentajeMeta = metaDiaria > 0 ? Math.min(100, (totalGanado / metaDiaria) * 100) : 0;
  const porcentajeMetaReal = metaDiaria > 0 ? (totalGanado / metaDiaria) * 100 : 0;
  const faltanteMeta = Math.max(0, metaDiaria - totalGanado);

  // Si ya hay promedio por hora en la sesión, proyecta con el ritmo real; si no, usa la metaHora (30.000)
  const tasaReferenciaHora = promHora > 0 ? promHora : (Number(config.metaHora) || 30000);
  const horasParaMeta = faltanteMeta > 0 && tasaReferenciaHora > 0 ? faltanteMeta / tasaReferenciaHora : 0;

  // Cálculos de gasolina (16.000 COP / 40 km = 400 COP/km)
  const rendimientoGalonKm = Number(config.rendimientoGalonKm) || 40;
  const precioGalonCOP = Number(config.precioGalonCOP) || 16000;
  const costoPorKm = rendimientoGalonKm > 0 ? precioGalonCOP / rendimientoGalonKm : 400;

  const gastoGasolinaEstimado = distanciaTotalKm * costoPorKm;
  const gananciaNeta = totalGanado - gastoGasolinaEstimado;

  const totalTanqueadasCOP = tanqueadas.reduce((acc, t) => acc + (Number(t.montoCOP) || 0), 0);
  const totalGalonesTanqueados = tanqueadas.reduce((acc, t) => acc + (Number(t.galones) || 0), 0);

  // Gastos ocultos: lavados y cambios de aceite
  const totalLavados = gastos
    .filter(g => g.tipo === 'lavado')
    .reduce((acc, g) => acc + (Number(g.montoCOP) || 0), 0);
  const totalAceite = gastos
    .filter(g => g.tipo === 'aceite')
    .reduce((acc, g) => acc + (Number(g.montoCOP) || 0), 0);
  const totalMantenimiento = totalLavados + totalAceite;
  const gananciaNetaReal = gananciaNeta - totalMantenimiento;

  return {
    viajesCalculados,
    totalCarreras: viajesCalculados.length,
    totalGanado,
    tiempoTotalMin,
    distanciaTotalKm,
    promHora,
    promKm,
    metaDiaria,
    porcentajeMeta,
    porcentajeMetaReal,
    faltanteMeta,
    horasParaMeta,
    totalEfectivo,
    totalTarjeta,
    cantEfectivo,
    cantTarjeta,
    costoPorKm,
    gastoGasolinaEstimado,
    gananciaNeta,
    totalTanqueadasCOP,
    totalGalonesTanqueados,
    totalLavados,
    totalAceite,
    totalMantenimiento,
    gananciaNetaReal,
    gastos
  };
}

// ==========================================
// 4. RENDERIZADO DEL DASHBOARD
// ==========================================

/**
 * Garantiza que el contenedor .brand-logo mantenga siempre el logo del
 * tacómetro vintage (PNG) y no dependa de ningún icono de Lucide Icons.
 */
function renderLogoMarca() {
  const brandLogoEl = document.querySelector('.brand-logo');
  if (!brandLogoEl) return;

  const tieneIconoLucide = brandLogoEl.querySelector('[data-lucide]');
  const tieneLogo = brandLogoEl.querySelector('img');

  if (tieneIconoLucide || !tieneLogo) {
    brandLogoEl.innerHTML = BRAND_LOGO_SVG;
  }
}

// ==========================================
// ANIMACIONES DE CONTADORES
// ==========================================
const CONTADORES_ANIMADOS = [
  'sesion-total-ganado',
  'sesion-prom-hora',
  'sesion-prom-km',
  'gas-gasto-estimado',
  'gas-gasto-mantenimiento',
  'gas-ganancia-neta',
  'gas-km-total',
  'uv-cop-hora',
  'uv-cop-km',
  'uv-precio'
];

function parsearNumeroEsCO(texto) {
  const limpio = String(texto).replace(/[^\d,.-]/g, '').trim();
  if (!limpio) return NaN;
  // es-CO: punto = separador de miles, coma = decimales
  return Number(limpio.replace(/\./g, '').replace(',', '.'));
}

function animarContador(el) {
  if (!el) return;
  const textoFinal = el.textContent.trim();
  const partes = textoFinal.match(/^([^\d-]*)(-?[\d.,]+)(.*)$/s);
  if (!partes) return;

  const prefijo = partes[1];
  const numeroTexto = partes[2];
  const sufijo = partes[3];
  const destino = parsearNumeroEsCO(numeroTexto);
  if (!Number.isFinite(destino)) return;

  const esMoneda = prefijo.includes('$');
  const decimales = esMoneda ? 0 : (numeroTexto.split(',')[1] || '').length || 1;
  const anterior = Number.isFinite(Number(el.dataset.animValor))
    ? Number(el.dataset.animValor)
    : 0;
  el.dataset.animValor = String(destino);

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion || Math.abs(destino - anterior) < 0.01) {
    el.textContent = textoFinal;
    return;
  }

  const duracion = 650;
  const inicio = performance.now();
  if (el._rafContador) cancelAnimationFrame(el._rafContador);

  const paso = ahora => {
    const t = Math.min(1, (ahora - inicio) / duracion);
    const eased = 1 - Math.pow(1 - t, 3);
    const actual = anterior + (destino - anterior) * eased;

    if (esMoneda) {
      el.textContent = `${formatCOP(actual)}${sufijo}`;
    } else {
      el.textContent = `${prefijo}${actual.toLocaleString('es-CO', {
        minimumFractionDigits: decimales,
        maximumFractionDigits: decimales
      })}${sufijo}`;
    }

    if (t < 1) {
      el._rafContador = requestAnimationFrame(paso);
    } else {
      el.textContent = textoFinal;
      el._rafContador = null;
    }
  };
  el._rafContador = requestAnimationFrame(paso);
}

function animarContadoresDashboard() {
  CONTADORES_ANIMADOS.forEach(id => animarContador(document.getElementById(id)));
}

function dispararShakeTacometro() {
  const tarjeta = document.getElementById('card-ultimo-viaje');
  if (!tarjeta) return;
  tarjeta.classList.remove('shake-gauge');
  void tarjeta.offsetWidth;
  tarjeta.classList.add('shake-gauge');
  tarjeta.addEventListener('animationend', () => tarjeta.classList.remove('shake-gauge'), { once: true });
}

function renderDashboard() {
  renderLogoMarca();

  const resumen = calcularResumenSesion(
    appData.sesionActual.viajes,
    appData.config,
    appData.sesionActual.tanqueadas,
    appData.sesionActual.gastos
  );

  renderEstadoJornada(resumen);
  renderUltimoViaje(resumen);
  renderResumenSesion(resumen);
  renderMetaDiaria(resumen);
  renderGraficos(resumen);
  renderSeccionGasolina(resumen);
  renderGastosMantenimiento(resumen);
  renderTablaHistorial(resumen);

  if (typeof lucide !== 'undefined' && typeof lucide.createIcons === 'function') {
    lucide.createIcons();
  }

  animarContadoresDashboard();
}

function renderEstadoJornada(resumen) {
  const elEstado = document.getElementById('estado-jornada');
  if (!elEstado) return;

  const fechaTexto = formatFechaCompleta(appData.sesionActual.fechaInicio);
  const nCarreras = resumen.totalCarreras;

  if (appData.sesionActual.estado === 'cerrada') {
    const fechaFinTexto = appData.sesionActual.fechaFin
      ? formatFechaCompleta(appData.sesionActual.fechaFin)
      : '—';
    elEstado.textContent = `Jornada cerrada el ${fechaFinTexto} • ${nCarreras} ${nCarreras === 1 ? 'carrera' : 'carreras'}`;
    elEstado.classList.add('shift-closed');
  } else {
    elEstado.textContent = `Jornada activa desde ${fechaTexto} • ${nCarreras} ${nCarreras === 1 ? 'carrera' : 'carreras'}`;
    elEstado.classList.remove('shift-closed');
  }
}

function renderUltimoViaje(resumen) {
  const badge = document.getElementById('ultimo-viaje-badge');
  const card = document.getElementById('card-ultimo-viaje');
  const contenedorVacio = document.getElementById('ultimo-viaje-vacio');
  const contenedorContenido = document.getElementById('ultimo-viaje-contenido');

  const viajes = resumen.viajesCalculados;

  const mapeoClases = {
    verde: { card: 'traffic-green', badge: 'badge-success' },
    amarillo: { card: 'traffic-yellow', badge: 'badge-warning' },
    rojo: { card: 'traffic-red', badge: 'badge-danger' },
    sinViajes: { card: 'traffic-none', badge: 'badge-neutral' }
  };

  const clasesCard = ['traffic-none', 'traffic-green', 'traffic-yellow', 'traffic-red'];
  const clasesBadge = ['badge-neutral', 'badge-success', 'badge-warning', 'badge-danger'];

  if (card) card.classList.remove(...clasesCard);
  if (badge) badge.classList.remove(...clasesBadge);

  if (viajes.length === 0) {
    if (contenedorVacio) {
      contenedorVacio.classList.remove('hidden');
      contenedorVacio.style.display = '';
    }
    if (contenedorContenido) {
      contenedorContenido.classList.add('hidden');
      contenedorContenido.style.display = 'none';
    }
    if (card) {
      card.classList.add(mapeoClases.sinViajes.card);
      card.dataset.estado = 'neutro';
    }
    if (badge) {
      badge.textContent = 'Sin datos';
      badge.classList.add(mapeoClases.sinViajes.badge);
      badge.dataset.estado = 'neutro';
    }
    return;
  }

  // Mostrar contenido y ocultar estado vacío
  if (contenedorVacio) {
    contenedorVacio.classList.add('hidden');
    contenedorVacio.style.display = 'none';
  }
  if (contenedorContenido) {
    contenedorContenido.classList.remove('hidden');
    contenedorContenido.style.display = '';
  }

  const ultimo = viajes[viajes.length - 1];
  const estiloActual = mapeoClases[ultimo.semaforo] || mapeoClases.rojo;

  // Aplicar semáforo en tarjeta y badge
  if (card) {
    card.classList.add(estiloActual.card);
    card.dataset.estado = ultimo.semaforo;
  }
  if (badge) {
    badge.textContent = ultimo.etiquetaSemaforo;
    badge.classList.add(estiloActual.badge);
    badge.dataset.estado = ultimo.semaforo;
  }

  // Poblar métricas del último viaje
  setText('uv-cop-hora', `${formatCOP(ultimo.copHora)}/h`);
  setText('uv-cop-km', `${formatCOP(ultimo.copKm)}/km`);
  setText('uv-precio', formatCOP(ultimo.precioCOP));
  setText('uv-metodo', ultimo.metodoPago || 'Efectivo');
  setText('uv-tiempo', `${formatNum(ultimo.tTotal, 0)} min`);
  setText(
    'uv-tiempo-desglose',
    `Recogida: ${formatNum(ultimo.tiempoRecogidaMin, 0)}m | Entrega: ${formatNum(ultimo.tiempoEntregaMin, 0)}m`
  );
  setText('uv-distancia', `${formatNum(ultimo.dTotal, 1)} km`);
  setText(
    'uv-distancia-desglose',
    `Recogida: ${formatNum(ultimo.distRecogidaKm, 1)}km | Entrega: ${formatNum(ultimo.distEntregaKm, 1)}km`
  );

  // Comparativa vs promedio de la sesión (y vs meta si es el primer viaje)
  const elVsHora = document.getElementById('uv-vs-hora');
  const elVsKm = document.getElementById('uv-vs-km');

  if (elVsHora) {
    const diffHora = ultimo.copHora - resumen.promHora;
    const pctHora = resumen.promHora > 0 ? (diffHora / resumen.promHora) * 100 : 0;
    if (viajes.length === 1) {
      const diffMetaH = ultimo.copHora - appData.config.metaHora;
      const signo = diffMetaH >= 0 ? '+' : '';
      elVsHora.textContent = `${signo}${formatCOP(diffMetaH)} vs meta (${formatCOP(appData.config.metaHora)}/h)`;
      elVsHora.style.color = diffMetaH >= 0 ? '#10b981' : '#ef4444';
    } else {
      const signo = diffHora >= 0 ? '+' : '';
      elVsHora.textContent = `${signo}${formatNum(pctHora, 1)}% (${signo}${formatCOP(diffHora)}) vs prom. sesión`;
      elVsHora.style.color = diffHora >= 0 ? '#10b981' : '#ef4444';
    }
  }

  if (elVsKm) {
    const diffKm = ultimo.copKm - resumen.promKm;
    const pctKm = resumen.promKm > 0 ? (diffKm / resumen.promKm) * 100 : 0;
    if (viajes.length === 1) {
      const diffMetaK = ultimo.copKm - appData.config.metaKm;
      const signo = diffMetaK >= 0 ? '+' : '';
      elVsKm.textContent = `${signo}${formatCOP(diffMetaK)} vs meta (${formatCOP(appData.config.metaKm)}/km)`;
      elVsKm.style.color = diffMetaK >= 0 ? '#10b981' : '#ef4444';
    } else {
      const signo = diffKm >= 0 ? '+' : '';
      elVsKm.textContent = `${signo}${formatNum(pctKm, 1)}% (${signo}${formatCOP(diffKm)}) vs prom. sesión`;
      elVsKm.style.color = diffKm >= 0 ? '#10b981' : '#ef4444';
    }
  }
}

function renderResumenSesion(resumen) {
  setText('sesion-total-ganado', formatCOP(resumen.totalGanado));
  setText('sesion-prom-hora', `${formatCOP(resumen.promHora)}/h`);
  setText('sesion-prom-km', `${formatCOP(resumen.promKm)}/km`);
  setText('sesion-tiempo-activo', formatDuracion(resumen.tiempoTotalMin));
  setText(
    'sesion-total-carreras',
    `${resumen.totalCarreras} ${resumen.totalCarreras === 1 ? 'carrera completada' : 'carreras completadas'}`
  );
}

function renderMetaDiaria(resumen) {
  const slider = document.getElementById('slider-meta-diaria');
  if (slider && Number(slider.value) !== resumen.metaDiaria) {
    slider.value = resumen.metaDiaria;
  }

  setText('meta-diaria-valor', formatCOP(resumen.metaDiaria));
  const pctEl = document.getElementById('meta-porcentaje');
  if (pctEl) {
    pctEl.textContent = `${formatNum(resumen.porcentajeMetaReal, 1)}% completado`;
    if (resumen.porcentajeMetaReal >= 100) {
      pctEl.className = 'badge badge-success';
    } else if (resumen.porcentajeMetaReal >= 50) {
      pctEl.className = 'badge badge-warning';
    } else {
      pctEl.className = 'badge badge-neutral';
    }
  }

  const barra = document.getElementById('barra-progreso-meta');
  if (barra) {
    barra.style.width = `${Math.min(100, Math.max(0, resumen.porcentajeMeta))}%`;
    if (resumen.porcentajeMetaReal >= 100) {
      barra.style.backgroundColor = '#10b981'; // Verde meta cumplida
    } else if (resumen.porcentajeMetaReal >= 60) {
      barra.style.backgroundColor = '#f59e0b'; // Amarillo en progreso
    } else {
      barra.style.backgroundColor = ''; // Color por defecto del CSS
    }
  }

  if (resumen.faltanteMeta <= 0) {
    setText('proyeccion-faltante', '¡Meta alcanzada! 🎉');
    setText('proyeccion-horas', '0h 0m restantes');
  } else {
    setText('proyeccion-faltante', formatCOP(resumen.faltanteMeta));
    const minRestantes = Math.round(resumen.horasParaMeta * 60);
    const sufijoModo = resumen.promHora > 0 ? 'al ritmo actual' : 'a ritmo meta ($30k/h)';
    setText('proyeccion-horas', `~${formatDuracion(minRestantes)} (${sufijoModo})`);
  }
}

function renderSeccionGasolina(resumen) {
  setText('gas-km-total', `${formatNum(resumen.distanciaTotalKm, 1)} km`);
  setText('gas-gasto-estimado', formatCOP(resumen.gastoGasolinaEstimado));
  setText('gas-gasto-mantenimiento', formatCOP(resumen.totalMantenimiento));
  setText(
    'gas-desglose-mantenimiento',
    `Lavados: ${formatCOP(resumen.totalLavados)} · Aceite: ${formatCOP(resumen.totalAceite)}`
  );
  setText('gas-ganancia-neta', formatCOP(resumen.gananciaNetaReal));
  setText('gas-ganancia-neta-bruta', `Antes de mantenimiento: ${formatCOP(resumen.gananciaNeta)}`);
  setText(
    'total-tanqueadas-sesion',
    `Total pagado en bomba: ${formatCOP(resumen.totalTanqueadasCOP)} (${formatNum(resumen.totalGalonesTanqueados, 2)} gal)`
  );

  const listaEl = document.getElementById('lista-tanqueadas');
  if (!listaEl) return;

  const tanqueadas = appData.sesionActual.tanqueadas;
  if (tanqueadas.length === 0) {
    listaEl.innerHTML = `<div class="empty-state" style="padding: 12px;">No hay tanqueadas registradas en esta jornada.</div>`;
    return;
  }

  listaEl.innerHTML = tanqueadas
    .slice()
    .reverse()
    .map(t => {
      const hora = formatFechaHora(t.timestamp);
      const monto = formatCOP(t.montoCOP);
      const gal = formatNum(t.galones, 2);
      const nota = t.nota ? ` — <em>${escaparHTML(t.nota)}</em>` : '';
      return `
        <div class="fuel-item" data-id="${t.id}">
          <div>
            <strong>${monto}</strong> <span style="opacity:0.85;">(${gal} gal)</span>
            <small style="opacity:0.7; margin-left:0.4rem;">${hora}</small>
            ${nota}
          </div>
          <button type="button" class="btn-table-action delete btn-eliminar-tanqueada" data-id="${t.id}" title="Eliminar tanqueada">
            <i data-lucide="trash-2"></i>
          </button>
        </div>
      `;
    })
    .join('');
}

function renderGastosMantenimiento(resumen) {
  const listaEl = document.getElementById('lista-gastos');
  setText('total-gastos-sesion', `Total mantenimiento: ${formatCOP(resumen.totalMantenimiento)}`);
  if (!listaEl) return;

  const gastos = (appData.sesionActual.gastos || []).slice().reverse();
  if (gastos.length === 0) {
    listaEl.innerHTML = `<div class="empty-state" style="padding: 12px;">No hay lavados ni cambios de aceite en esta jornada.</div>`;
    return;
  }

  listaEl.innerHTML = gastos
    .map(g => {
      const esAceite = g.tipo === 'aceite';
      const etiqueta = esAceite ? 'Cambio de aceite' : 'Lavado';
      const hora = formatFechaHora(g.timestamp);
      const nota = g.nota ? ` — <em>${escaparHTML(g.nota)}</em>` : '';
      const odometro = esAceite && g.odometro ? ` · ${formatNum(g.odometro, 0)} km` : '';
      return `
        <div class="fuel-item" data-id="${g.id}">
          <div>
            <strong>${etiqueta}: ${formatCOP(g.montoCOP)}</strong>
            <small style="opacity:0.7; margin-left:0.4rem;">${hora}${odometro}</small>
            ${nota}
          </div>
          <button type="button" class="btn-table-action delete btn-eliminar-gasto" data-id="${g.id}" title="Eliminar gasto">
            <i data-lucide="trash-2"></i>
          </button>
        </div>
      `;
    })
    .join('');
}

function renderTablaHistorial(resumen) {
  const tbody = document.getElementById('tabla-historial-body');
  if (!tbody) return;

  const viajes = resumen.viajesCalculados;

  if (viajes.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="10" style="text-align:center; padding:1.5rem; opacity:0.7;">
          Aún no has registrado carreras en esta jornada. Haz clic en "REGISTRAR CARRERA" para empezar.
        </td>
      </tr>
    `;
    return;
  }

  const mapeoBadge = {
    verde: 'badge-success',
    amarillo: 'badge-warning',
    rojo: 'badge-danger'
  };

  // Mostrar del más reciente al más antiguo conservando el número de carrera original
  tbody.innerHTML = viajes
    .map((v, idx) => ({ ...v, numeroCarrera: idx + 1 }))
    .reverse()
    .map(v => {
      const claseBadge = mapeoBadge[v.semaforo] || 'badge-danger';

      return `
        <tr data-id="${v.id}">
          <td><strong>#${v.numeroCarrera}</strong></td>
          <td>${formatFechaHora(v.timestamp)}</td>
          <td><strong>${formatCOP(v.precioCOP)}</strong></td>
          <td>${escaparHTML(v.metodoPago || 'Efectivo')}</td>
          <td>${formatNum(v.dTotal, 1)} km <small class="metric-sub" style="display:block;">(${formatNum(v.distRecogidaKm, 1)} + ${formatNum(v.distEntregaKm, 1)})</small></td>
          <td>${formatNum(v.tTotal, 0)} min <small class="metric-sub" style="display:block;">(${formatNum(v.tiempoRecogidaMin, 0)} + ${formatNum(v.tiempoEntregaMin, 0)})</small></td>
          <td>${formatCOP(v.copHora)}/h</td>
          <td>${formatCOP(v.copKm)}/km</td>
          <td>
            <span class="badge ${claseBadge}">
              ${v.etiquetaSemaforo}
            </span>
          </td>
          <td>
            <div class="table-actions">
              <button type="button" class="btn-table-action edit btn-editar-viaje" data-id="${v.id}" title="Editar carrera">
                <i data-lucide="pencil"></i>
              </button>
              <button type="button" class="btn-table-action delete btn-eliminar-viaje" data-id="${v.id}" title="Eliminar carrera">
                <i data-lucide="trash-2"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    })
    .join('');
}

// ==========================================
// 5. GRÁFICOS CON CHART.JS
// ==========================================

function renderGraficos(resumen) {
  // Animaciones globales de Chart.js (una sola vez)
  if (typeof Chart !== 'undefined' && !Chart.__didiAnimDefaults) {
    try {
      Chart.defaults.animation = { duration: 700, easing: 'easeOutQuart' };
      if (Chart.defaults.animations && Chart.defaults.animations.colors) {
        Chart.defaults.animations.colors = { duration: 500, easing: 'easeOutQuad' };
      }
      Chart.__didiAnimDefaults = true;
    } catch (error) {
      // Si Chart.js cambia su API, se conservan sus animaciones por defecto.
    }
  }
  renderGraficoPagos(resumen);
  renderGraficoCarreras(resumen);
}

function renderGraficoPagos(resumen) {
  const textoResumen = document.getElementById('resumen-pagos-texto');
  if (textoResumen) {
    const total = resumen.totalGanado;
    const pctEf = total > 0 ? (resumen.totalEfectivo / total) * 100 : 0;
    const pctTj = total > 0 ? (resumen.totalTarjeta / total) * 100 : 0;
    textoResumen.textContent = `Efectivo: ${formatCOP(resumen.totalEfectivo)} (${formatNum(pctEf, 0)}% • ${resumen.cantEfectivo} viajes) | Tarjeta: ${formatCOP(resumen.totalTarjeta)} (${formatNum(pctTj, 0)}% • ${resumen.cantTarjeta} viajes)`;
  }

  const canvas = document.getElementById('chart-pagos');
  if (!canvas || typeof Chart === 'undefined') return;

  const sinDatos = resumen.totalEfectivo === 0 && resumen.totalTarjeta === 0;
  const dataValues = sinDatos ? [1] : [resumen.totalEfectivo, resumen.totalTarjeta];
  const dataLabels = sinDatos ? ['Sin carreras registradas'] : ['Efectivo', 'Tarjeta'];
  const bgColors = sinDatos
    ? ['rgba(148, 163, 184, 0.15)']
    : ['#10b981', '#3b82f6'];

  const pluginTextoCentroPagos = {
    id: 'textoCentroPagos',
    afterDraw(chart) {
      const esVacio = chart.config.options.plugins?.textoCentroPagos?.sinDatos;
      if (!esVacio) return;

      const { ctx, chartArea } = chart;
      if (!chartArea) return;

      const centerX = (chartArea.left + chartArea.right) / 2;
      const centerY = (chartArea.top + chartArea.bottom) / 2;

      ctx.save();
      ctx.fillStyle = '#94a3b8';
      ctx.font = '600 13px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Sin carreras registradas', centerX, centerY);
      ctx.restore();
    }
  };

  if (chartPagosInstance) {
    chartPagosInstance.data.labels = dataLabels;
    chartPagosInstance.data.datasets[0].data = dataValues;
    chartPagosInstance.data.datasets[0].backgroundColor = bgColors;
    chartPagosInstance.options.plugins.textoCentroPagos = { sinDatos };
    chartPagosInstance.update();
    return;
  }

  chartPagosInstance = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: dataLabels,
      datasets: [
        {
          data: dataValues,
          backgroundColor: bgColors,
          borderWidth: 0,
          hoverOffset: 6
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '68%',
      plugins: {
        textoCentroPagos: { sinDatos },
        legend: {
          position: 'bottom',
          labels: {
            color: '#94a3b8',
            padding: 14,
            font: { size: 12 }
          }
        },
        tooltip: {
          callbacks: {
            label: function (ctx) {
              if (chartPagosInstance?.options?.plugins?.textoCentroPagos?.sinDatos) {
                return ' Sin carreras registradas';
              }
              const val = ctx.raw || 0;
              const totalActual = (chartPagosInstance.data.datasets[0].data || []).reduce((a, b) => a + b, 0);
              const pct = totalActual > 0 ? ((val / totalActual) * 100).toFixed(1) : 0;
              return ` ${ctx.label}: ${formatCOP(val)} (${pct}%)`;
            }
          }
        }
      }
    },
    plugins: [pluginTextoCentroPagos]
  });
}

function renderGraficoCarreras(resumen) {
  const canvas = document.getElementById('chart-carreras');
  if (!canvas || typeof Chart === 'undefined') return;

  const viajes = resumen.viajesCalculados;
  const metaHora = Number(appData.config.metaHora) || 30000;

  const labels = viajes.map((_, i) => `#${i + 1}`);
  const valoresCopHora = viajes.map(v => Math.round(v.copHora));
  const coloresBarras = viajes.map(v => {
    if (v.semaforo === 'verde') return 'rgba(16, 185, 129, 0.85)';
    if (v.semaforo === 'amarillo') return 'rgba(245, 158, 11, 0.85)';
    return 'rgba(239, 68, 68, 0.85)';
  });
  const lineaMeta = viajes.map(() => metaHora);

  // Plugin para dibujar línea de referencia a 30.000 COP/h y estado vacío si no hay viajes
  const pluginLineaMeta = {
    id: 'lineaReferenciaMetaHora',
    afterDraw(chart) {
      const yScale = chart.scales.y;
      const chartArea = chart.chartArea;
      if (!yScale || !chartArea) return;

      const ctx = chart.ctx;
      const metaActual = Number(appData.config.metaHora) || 30000;
      const yPos = yScale.getPixelForValue(metaActual);

      if (yPos >= chartArea.top && yPos <= chartArea.bottom) {
        ctx.save();
        ctx.beginPath();
        ctx.setLineDash([6, 4]);
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#ff6b00';
        ctx.moveTo(chartArea.left, yPos);
        ctx.lineTo(chartArea.right, yPos);
        ctx.stroke();

        ctx.fillStyle = '#ff6b00';
        ctx.font = '600 11px Inter, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(`Meta: ${formatCOP(metaActual)}/h`, chartArea.right - 6, yPos - 6);
        ctx.restore();
      }

      const datosBarras = chart.data.datasets[0]?.data || [];
      if (datosBarras.length === 0) {
        const centerX = (chartArea.left + chartArea.right) / 2;
        const centerY = (chartArea.top + chartArea.bottom) / 2 + 18;

        ctx.save();
        ctx.fillStyle = '#94a3b8';
        ctx.font = '500 13px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Registra una carrera para ver el historial de COP/h', centerX, centerY);
        ctx.restore();
      }
    }
  };

  if (chartCarrerasInstance) {
    chartCarrerasInstance.data.labels = labels;
    chartCarrerasInstance.data.datasets[0].data = valoresCopHora;
    chartCarrerasInstance.data.datasets[0].backgroundColor = coloresBarras;
    chartCarrerasInstance.data.datasets[1].data = lineaMeta;
    chartCarrerasInstance.options.scales.y.suggestedMax = Math.max(metaHora * 1.3, ...valoresCopHora, 35000);
    chartCarrerasInstance.update();
    return;
  }

  chartCarrerasInstance = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          type: 'bar',
          label: 'COP / Hora por Carrera',
          data: valoresCopHora,
          backgroundColor: coloresBarras,
          borderRadius: 6,
          maxBarThickness: 42,
          order: 2
        },
        {
          type: 'line',
          label: `Meta (${formatCOP(metaHora)}/h)`,
          data: lineaMeta,
          borderColor: '#ff6b00',
          borderWidth: 2,
          borderDash: [6, 4],
          pointRadius: 0,
          fill: false,
          order: 1
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          ticks: { color: '#94a3b8' },
          grid: { display: false }
        },
        y: {
          beginAtZero: true,
          suggestedMax: Math.max(metaHora * 1.3, ...valoresCopHora, 35000),
          ticks: {
            color: '#94a3b8',
            callback: function (value) {
              return '$' + (value / 1000).toFixed(0) + 'k';
            }
          },
          grid: {
            color: 'rgba(148, 163, 184, 0.12)'
          }
        }
      },
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: '#94a3b8',
            font: { size: 12 }
          }
        },
        tooltip: {
          callbacks: {
            label: function (ctx) {
              return ` ${ctx.dataset.label}: ${formatCOP(ctx.raw)}/h`;
            }
          }
        }
      }
    },
    plugins: [pluginLineaMeta]
  });
}

// ==========================================
// 6. GESTIÓN DE MODALES (VIAJE Y TANQUEADA)
// ==========================================

function mostrarModal(modalEl) {
  if (!modalEl) return;
  modalEl.classList.remove('hidden');
  modalEl.classList.add('active', 'open', 'show');
  modalEl.style.display = 'flex';
  modalEl.setAttribute('aria-hidden', 'false');
}

function ocultarModal(modalEl) {
  if (!modalEl) return;
  modalEl.classList.remove('active', 'open', 'show');
  modalEl.classList.add('hidden');
  modalEl.style.display = 'none';
  modalEl.setAttribute('aria-hidden', 'true');
}

function abrirModalViaje(viajeParaEditar = null) {
  const modal = document.getElementById('modal-viaje');
  const form = document.getElementById('form-viaje');
  if (!modal || !form) return;

  form.reset();

  // Modo del formulario: editar siempre en detallado; crear por defecto en rápido
  aplicarModoFormularioViaje(viajeParaEditar ? 'detallado' : 'rapido');

  const inputId = document.getElementById('viaje-id');
  const inputDistRec = document.getElementById('distRecogidaKm');
  const inputTiempoRec = document.getElementById('tiempoRecogidaMin');
  const inputDistEnt = document.getElementById('distEntregaKm');
  const inputTiempoEnt = document.getElementById('tiempoEntregaMin');
  const inputPrecio = document.getElementById('precioCOP');
  const radiosMetodo = document.querySelectorAll('input[name="metodoPago"]');

  if (viajeParaEditar) {
    if (inputId) inputId.value = viajeParaEditar.id;
    if (inputDistRec) inputDistRec.value = viajeParaEditar.distRecogidaKm;
    if (inputTiempoRec) inputTiempoRec.value = viajeParaEditar.tiempoRecogidaMin;
    if (inputDistEnt) inputDistEnt.value = viajeParaEditar.distEntregaKm;
    if (inputTiempoEnt) inputTiempoEnt.value = viajeParaEditar.tiempoEntregaMin;
    if (inputPrecio) inputPrecio.value = viajeParaEditar.precioCOP;

    const metodoGuardado = String(viajeParaEditar.metodoPago || 'Efectivo').toLowerCase();
    radiosMetodo.forEach(radio => {
      radio.checked = radio.value.toLowerCase() === metodoGuardado;
    });
  } else {
    if (inputId) inputId.value = '';
    // Seleccionar Efectivo por defecto
    let algunoMarcado = false;
    radiosMetodo.forEach(radio => {
      if (radio.value.toLowerCase() === 'efectivo') {
        radio.checked = true;
        algunoMarcado = true;
      }
    });
    if (!algunoMarcado && radiosMetodo.length > 0) {
      radiosMetodo[0].checked = true;
    }
  }

  mostrarModal(modal);
  const primerCampo = viajeParaEditar
    ? inputDistRec
    : document.getElementById('rapidoDistanciaKm');
  if (primerCampo) setTimeout(() => primerCampo.focus(), 50);
}

function cerrarModalViaje() {
  const modal = document.getElementById('modal-viaje');
  const form = document.getElementById('form-viaje');
  if (form) form.reset();
  const inputId = document.getElementById('viaje-id');
  if (inputId) inputId.value = '';
  ocultarModal(modal);
}

function guardarViajeDesdeFormulario(evento) {
  evento.preventDefault();

  const idExistente = document.getElementById('viaje-id')?.value?.trim();
  let distRecogidaKm;
  let tiempoRecogidaMin;
  let distEntregaKm;
  let tiempoEntregaMin;
  let precioCOP;

  if (modoFormularioViaje === 'rapido') {
    // Modo rápido: distancia y tiempo totales equivalen a la entrega
    const distanciaTotal = parseFloat(document.getElementById('rapidoDistanciaKm')?.value) || 0;
    const tiempoTotal = parseFloat(document.getElementById('rapidoTiempoMin')?.value) || 0;
    precioCOP = parseFloat(document.getElementById('rapidoPrecioCOP')?.value) || 0;
    distRecogidaKm = 0;
    tiempoRecogidaMin = 0;
    distEntregaKm = distanciaTotal;
    tiempoEntregaMin = tiempoTotal;
  } else {
    distRecogidaKm = parseFloat(document.getElementById('distRecogidaKm')?.value) || 0;
    tiempoRecogidaMin = parseFloat(document.getElementById('tiempoRecogidaMin')?.value) || 0;
    distEntregaKm = parseFloat(document.getElementById('distEntregaKm')?.value) || 0;
    tiempoEntregaMin = parseFloat(document.getElementById('tiempoEntregaMin')?.value) || 0;
    precioCOP = parseFloat(document.getElementById('precioCOP')?.value) || 0;
  }

  const radioSeleccionado = document.querySelector('input[name="metodoPago"]:checked');
  const metodoValor = radioSeleccionado ? radioSeleccionado.value : 'Efectivo';
  const metodoPago =
    metodoValor.toLowerCase() === 'tarjeta'
      ? 'Tarjeta'
      : metodoValor.toLowerCase() === 'efectivo'
      ? 'Efectivo'
      : metodoValor;

  if (distRecogidaKm + distEntregaKm <= 0) {
    showToast('La distancia total del viaje debe ser mayor a 0 km.', 'warning');
    return;
  }
  if (tiempoRecogidaMin + tiempoEntregaMin <= 0) {
    showToast('El tiempo total del viaje debe ser mayor a 0 minutos.', 'warning');
    return;
  }
  if (precioCOP <= 0) {
    showToast('El precio del viaje debe ser mayor a $0 COP.', 'warning');
    return;
  }

  if (idExistente) {
    const idx = appData.sesionActual.viajes.findIndex(v => v.id === idExistente);
    if (idx !== -1) {
      appData.sesionActual.viajes[idx] = {
        ...appData.sesionActual.viajes[idx],
        distRecogidaKm,
        tiempoRecogidaMin,
        distEntregaKm,
        tiempoEntregaMin,
        precioCOP,
        metodoPago
      };
    }
  } else {
    const nuevoViaje = {
      id: generarId(),
      timestamp: new Date().toISOString(),
      distRecogidaKm,
      tiempoRecogidaMin,
      distEntregaKm,
      tiempoEntregaMin,
      precioCOP,
      metodoPago
    };
    appData.sesionActual.viajes.push(nuevoViaje);
  }

  guardarDatos();
  cerrarModalViaje();
  renderDashboard();
  dispararShakeTacometro();

  const metricasGuardadas = calcularMetricasViaje({
    distRecogidaKm,
    tiempoRecogidaMin,
    distEntregaKm,
    tiempoEntregaMin,
    precioCOP,
    metodoPago
  });
  reproducirTono(metricasGuardadas.semaforo);

  showToast(
    idExistente ? 'Carrera actualizada correctamente.' : 'Carrera registrada correctamente.',
    'success'
  );
}

function abrirModalTanqueada() {
  if (!jornadaActivaParaEdicion()) return;
  const modal = document.getElementById('modal-tanqueada');
  const form = document.getElementById('form-tanqueada');
  if (!modal || !form) return;

  form.reset();
  mostrarModal(modal);

  const inputMonto = document.getElementById('tanqueadaMontoCOP');
  if (inputMonto) setTimeout(() => inputMonto.focus(), 50);
}

function cerrarModalTanqueada() {
  const modal = document.getElementById('modal-tanqueada');
  const form = document.getElementById('form-tanqueada');
  if (form) form.reset();
  ocultarModal(modal);
}

function guardarTanqueadaDesdeFormulario(evento) {
  evento.preventDefault();

  if (!jornadaActivaParaEdicion()) {
    cerrarModalTanqueada();
    return;
  }

  const montoCOP = parseFloat(document.getElementById('tanqueadaMontoCOP')?.value) || 0;
  let galones = parseFloat(document.getElementById('tanqueadaGalones')?.value) || 0;
  const nota = document.getElementById('tanqueadaNota')?.value?.trim() || '';

  if (montoCOP <= 0) {
    showToast('Ingresa un monto válido en COP para la tanqueada.', 'warning');
    return;
  }

  // Si no ingresó los galones manualmente, se calculan según el precio por galón configurado (16.000 COP)
  if (galones <= 0) {
    const precioGalon = Number(appData.config.precioGalonCOP) || 16000;
    galones = Number((montoCOP / precioGalon).toFixed(2));
  }

  const nuevaTanqueada = {
    id: generarId(),
    timestamp: new Date().toISOString(),
    montoCOP,
    galones,
    nota
  };

  appData.sesionActual.tanqueadas.push(nuevaTanqueada);
  guardarDatos();
  cerrarModalTanqueada();
  renderDashboard();
  showToast('Tanqueada registrada correctamente.', 'success');
}

// ==========================================
// 7. CRUD Y ACCIONES DE JORNADA / EXPORTACIÓN
// ==========================================

function editarViaje(id) {
  if (!jornadaActivaParaEdicion()) return;
  const viaje = appData.sesionActual.viajes.find(v => v.id === id);
  if (!viaje) return;
  abrirModalViaje(viaje);
}

/**
 * Bloquea la edición de datos cuando la jornada está cerrada (inmutable).
 */
function jornadaActivaParaEdicion() {
  if (appData.sesionActual.estado === 'activa') return true;
  showToast('La jornada está cerrada y es inmutable. Inicia una nueva jornada para editar.', 'warning', 4000);
  return false;
}

function eliminarViaje(id) {
  if (!jornadaActivaParaEdicion()) return;
  const viaje = appData.sesionActual.viajes.find(v => v.id === id);
  if (!viaje) return;

  confirmDialog(
    `¿Seguro que deseas eliminar este viaje de ${formatCOP(viaje.precioCOP)}?`,
    'Eliminar viaje'
  ).then(confirmar => {
    if (!confirmar) return;
    appData.sesionActual.viajes = appData.sesionActual.viajes.filter(v => v.id !== id);
    guardarDatos();
    renderDashboard();
    showToast('Viaje eliminado.', 'info');
  });
}

function eliminarTanqueada(id) {
  if (!jornadaActivaParaEdicion()) return;
  confirmDialog('¿Deseas eliminar este registro de tanqueada?', 'Eliminar tanqueada').then(confirmar => {
    if (!confirmar) return;
    appData.sesionActual.tanqueadas = appData.sesionActual.tanqueadas.filter(t => t.id !== id);
    guardarDatos();
    renderDashboard();
    showToast('Registro de tanqueada eliminado.', 'info');
  });
}

function eliminarGasto(id) {
  if (!jornadaActivaParaEdicion()) return;
  confirmDialog('¿Deseas eliminar este gasto de mantenimiento?', 'Eliminar gasto').then(confirmar => {
    if (!confirmar) return;
    appData.sesionActual.gastos = (appData.sesionActual.gastos || []).filter(g => g.id !== id);
    guardarDatos();
    renderDashboard();
    showToast('Gasto eliminado.', 'info');
  });
}

// --- Registro de gastos ocultos: lavado y cambio de aceite ---
function abrirModalGasto(tipo = 'lavado') {
  if (!jornadaActivaParaEdicion()) return;
  const modal = document.getElementById('modal-gasto');
  const form = document.getElementById('form-gasto');
  if (!modal || !form) return;

  form.reset();
  const esAceite = tipo === 'aceite';
  const inputTipo = document.getElementById('gasto-tipo');
  if (inputTipo) inputTipo.value = esAceite ? 'aceite' : 'lavado';

  setText('modal-gasto-titulo', esAceite ? 'Cambio de Aceite' : 'Lavado de Vehículo');

  const inputMonto = document.getElementById('gastoMontoCOP');
  if (inputMonto) {
    inputMonto.value = esAceite ? Number(appData.config.costoAceiteCOP) || 200000 : '';
  }

  const grupoOdometro = document.getElementById('grupo-odometro');
  if (grupoOdometro) grupoOdometro.style.display = esAceite ? '' : 'none';

  const pistaIntervalo = document.getElementById('gasto-pista-aceite');
  if (pistaIntervalo) {
    pistaIntervalo.style.display = esAceite ? '' : 'none';
    if (esAceite) {
      pistaIntervalo.textContent = `Intervalo configurado: cada ${formatNum(appData.config.intervaloAceiteKm, 0)} km.`;
    }
  }

  mostrarModal(modal);
  if (inputMonto) setTimeout(() => inputMonto.focus(), 50);
}

function cerrarModalGasto() {
  const modal = document.getElementById('modal-gasto');
  const form = document.getElementById('form-gasto');
  if (form) form.reset();
  ocultarModal(modal);
}

function guardarGastoDesdeFormulario(evento) {
  evento.preventDefault();

  if (!jornadaActivaParaEdicion()) {
    cerrarModalGasto();
    return;
  }

  const tipo = document.getElementById('gasto-tipo')?.value === 'aceite' ? 'aceite' : 'lavado';
  const montoCOP = parseFloat(document.getElementById('gastoMontoCOP')?.value) || 0;
  const odometro = parseFloat(document.getElementById('gastoOdometro')?.value) || null;
  const nota = document.getElementById('gastoNota')?.value?.trim() || '';

  if (montoCOP <= 0) {
    showToast('Ingresa un monto válido en COP para el gasto.', 'warning');
    return;
  }

  appData.sesionActual.gastos = appData.sesionActual.gastos || [];
  appData.sesionActual.gastos.push({
    id: generarId(),
    timestamp: new Date().toISOString(),
    tipo,
    montoCOP,
    odometro,
    nota
  });

  guardarDatos();
  cerrarModalGasto();
  renderDashboard();
  showToast(
    tipo === 'aceite' ? 'Cambio de aceite registrado.' : 'Lavado registrado.',
    'success'
  );
}

// --- Cierre de turno / jornada ---
function construirResumenCongelado(resumen, fechaFin) {
  return {
    totalCarreras: resumen.totalCarreras,
    totalGanado: resumen.totalGanado,
    tiempoTotalMin: resumen.tiempoTotalMin,
    distanciaTotalKm: resumen.distanciaTotalKm,
    promHora: resumen.promHora,
    promKm: resumen.promKm,
    gastoGasolinaEstimado: resumen.gastoGasolinaEstimado,
    totalLavados: resumen.totalLavados,
    totalAceite: resumen.totalAceite,
    totalMantenimiento: resumen.totalMantenimiento,
    gananciaNeta: resumen.gananciaNeta,
    gananciaNetaReal: resumen.gananciaNetaReal,
    totalTanqueadasCOP: resumen.totalTanqueadasCOP,
    fechaInicio: appData.sesionActual.fechaInicio,
    fechaFin
  };
}

function cerrarJornada() {
  if (appData.sesionActual.estado !== 'activa') {
    showToast('La jornada ya está cerrada.', 'info');
    return;
  }
  if (appData.sesionActual.viajes.length === 0) {
    showToast('Registra al menos una carrera antes de cerrar el turno.', 'warning');
    return;
  }

  const resumen = calcularResumenSesion(
    appData.sesionActual.viajes,
    appData.config,
    appData.sesionActual.tanqueadas,
    appData.sesionActual.gastos
  );

  confirmDialog(
    `Vas a cerrar la jornada con ${resumen.totalCarreras} carreras y ${formatCOP(
      resumen.totalGanado
    )} brutos. Las métricas quedarán congeladas en el historial.`,
    'Finalizar Turno'
  ).then(confirmar => {
    if (!confirmar) return;

    const fechaFin = new Date().toISOString();
    appData.sesionActual.estado = 'cerrada';
    appData.sesionActual.fechaFin = fechaFin;
    appData.sesionActual.resumen = construirResumenCongelado(resumen, fechaFin);

    const persistencia = guardarDatos();
    renderDashboard();
    showToast('Jornada cerrada. Métricas congeladas en el historial.', 'success', 4500);
    Promise.resolve(persistencia).then(() => refrescarAnalitica());
  });
}

function reiniciarJornada() {
  const tieneDatos =
    appData.sesionActual.viajes.length > 0 ||
    appData.sesionActual.tanqueadas.length > 0 ||
    (appData.sesionActual.gastos || []).length > 0;

  const mensaje = tieneDatos
    ? '¿Estás seguro de iniciar una nueva jornada? Se borrarán los viajes, tanqueadas y gastos de la sesión actual.'
    : '¿Deseas reiniciar el contador de inicio de la jornada actual?';

  confirmDialog(mensaje, 'Iniciar / Reiniciar Jornada').then(confirmar => {
    if (!confirmar) return;
    crearNuevaJornada();
    showToast('Nueva jornada iniciada.', 'success');
  });
}

/**
 * Crea una jornada limpia y la persiste. Si la jornada anterior estaba
 * cerrada, esta se conserva inmutable en IndexedDB.
 */
function crearNuevaJornada() {
  appData.sesionActual = {
    id: generarId(),
    fechaInicio: new Date().toISOString(),
    fechaFin: null,
    estado: 'activa',
    resumen: null,
    viajes: [],
    tanqueadas: [],
    gastos: []
  };
  guardarDatos();
  renderDashboard();
  refrescarAnalitica();
}

/**
 * Garantiza que exista una jornada activa antes de registrar una carrera.
 * Si la jornada está cerrada, solicita confirmación para iniciar una nueva.
 */
function asegurarJornadaActiva() {
  if (appData.sesionActual.estado === 'activa') return Promise.resolve(true);

  return confirmDialog(
    'La jornada actual está cerrada. ¿Iniciar una nueva jornada para registrar esta carrera?',
    'Jornada cerrada'
  ).then(confirmar => {
    if (!confirmar) return false;
    crearNuevaJornada();
    showToast('Nueva jornada iniciada.', 'success');
    return true;
  });
}

function exportarCSV() {
  const resumen = calcularResumenSesion(
    appData.sesionActual.viajes,
    appData.config,
    appData.sesionActual.tanqueadas,
    appData.sesionActual.gastos
  );

  if (resumen.viajesCalculados.length === 0) {
    showToast('No hay viajes en la sesión actual para exportar.', 'info');
    return;
  }

  const encabezados = [
    'Nro Carrera',
    'Fecha y Hora',
    'Dist. Recogida (km)',
    'Tiempo Recogida (min)',
    'Dist. Entrega (km)',
    'Tiempo Entrega (min)',
    'Distancia Total (km)',
    'Tiempo Total (min)',
    'Precio (COP)',
    'Metodo de Pago',
    'COP por Hora',
    'COP por Km',
    'Rentabilidad (Semaforo)',
    'Gasto Gasolina Est. (COP)',
    'Ganancia Neta Est. (COP)'
  ];

  const filas = resumen.viajesCalculados.map((v, index) => [
    index + 1,
    new Date(v.timestamp).toLocaleString('es-CO'),
    v.distRecogidaKm.toFixed(2).replace('.', ','),
    v.tiempoRecogidaMin,
    v.distEntregaKm.toFixed(2).replace('.', ','),
    v.tiempoEntregaMin,
    v.dTotal.toFixed(2).replace('.', ','),
    v.tTotal,
    Math.round(v.precioCOP),
    v.metodoPago,
    Math.round(v.copHora),
    Math.round(v.copKm),
    v.etiquetaSemaforo,
    Math.round(v.gastoGasolinaViaje),
    Math.round(v.gananciaNetaViaje)
  ]);

  // Fila de resumen total al final del archivo
  filas.push([]);
  filas.push([
    'RESUMEN SESION',
    new Date(appData.sesionActual.fechaInicio).toLocaleString('es-CO'),
    '',
    '',
    '',
    '',
    resumen.distanciaTotalKm.toFixed(2).replace('.', ','),
    resumen.tiempoTotalMin,
    Math.round(resumen.totalGanado),
    `Efectivo: ${Math.round(resumen.totalEfectivo)} | Tarjeta: ${Math.round(resumen.totalTarjeta)}`,
    Math.round(resumen.promHora),
    Math.round(resumen.promKm),
    `Meta Diaria: ${Math.round(resumen.metaDiaria)}`,
    Math.round(resumen.gastoGasolinaEstimado),
    Math.round(resumen.gananciaNeta)
  ]);

  // Separador punto y coma (;) ideal para Excel en español + BOM UTF-8
  const contenidoCSV =
    '\uFEFF' +
    [encabezados, ...filas]
      .map(fila =>
        fila
          .map(celda => {
            const texto = celda === null || celda === undefined ? '' : String(celda);
            return `"${texto.replace(/"/g, '""')}"`;
          })
          .join(';')
      )
      .join('\r\n');

  const blob = new Blob([contenidoCSV], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const fechaArchivo = new Date().toISOString().slice(0, 10);

  link.setAttribute('href', url);
  link.setAttribute('download', `didi_jornada_${fechaArchivo}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ==========================================
// 8. HELPERS DOM Y EVENT LISTENERS
// ==========================================

function setText(id, texto) {
  const el = document.getElementById(id);
  if (el) el.textContent = texto;
}

function escaparHTML(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function configurarEventListeners() {
  // Botones principales de cabecera y acciones
  const btnReiniciar = document.getElementById('btn-reiniciar-jornada');
  if (btnReiniciar) btnReiniciar.addEventListener('click', reiniciarJornada);

  const btnAudio = document.getElementById('btn-toggle-audio');
  if (btnAudio) btnAudio.addEventListener('click', alternarAudio);

  // Selector Modo Rápido / Desglose Detallado
  document.querySelectorAll('.form-mode-toggle .mode-btn').forEach(boton => {
    boton.addEventListener('click', () => {
      aplicarModoFormularioViaje(boton.dataset.modo);
      const idCampo =
        boton.dataset.modo === 'rapido' ? 'rapidoDistanciaKm' : 'distRecogidaKm';
      const campo = document.getElementById(idCampo);
      if (campo) setTimeout(() => campo.focus(), 40);
    });
  });

  const btnAbrirViaje = document.getElementById('btn-abrir-modal-viaje');
  if (btnAbrirViaje) {
    btnAbrirViaje.addEventListener('click', () => {
      asegurarJornadaActiva().then(activa => {
        if (activa) abrirModalViaje(null);
      });
    });
  }

  const btnAbrirTanqueada = document.getElementById('btn-abrir-modal-tanqueada');
  if (btnAbrirTanqueada) btnAbrirTanqueada.addEventListener('click', abrirModalTanqueada);

  // Costos ocultos: lavado y aceite
  const btnGastoLavado = document.getElementById('btn-abrir-modal-gasto-lavado');
  if (btnGastoLavado) btnGastoLavado.addEventListener('click', () => abrirModalGasto('lavado'));

  const btnGastoAceite = document.getElementById('btn-abrir-modal-gasto-aceite');
  if (btnGastoAceite) btnGastoAceite.addEventListener('click', () => abrirModalGasto('aceite'));

  const formGasto = document.getElementById('form-gasto');
  if (formGasto) formGasto.addEventListener('submit', guardarGastoDesdeFormulario);

  const btnCerrarGasto = document.getElementById('btn-cerrar-modal-gasto');
  if (btnCerrarGasto) btnCerrarGasto.addEventListener('click', cerrarModalGasto);

  const btnCancelarGasto = document.getElementById('btn-cancelar-gasto');
  if (btnCancelarGasto) btnCancelarGasto.addEventListener('click', cerrarModalGasto);

  const modalGasto = document.getElementById('modal-gasto');
  if (modalGasto) {
    modalGasto.addEventListener('click', e => {
      if (e.target === modalGasto) cerrarModalGasto();
    });
  }

  const btnCerrarJornada = document.getElementById('btn-cerrar-jornada');
  if (btnCerrarJornada) btnCerrarJornada.addEventListener('click', cerrarJornada);

  const listaGastos = document.getElementById('lista-gastos');
  if (listaGastos) {
    listaGastos.addEventListener('click', e => {
      const btnEliminar = e.target.closest('.btn-eliminar-gasto');
      if (btnEliminar) eliminarGasto(btnEliminar.dataset.id);
    });
  }

  const btnExportarCSV = document.getElementById('btn-exportar-csv');
  if (btnExportarCSV) btnExportarCSV.addEventListener('click', exportarCSV);

  // Slider de meta diaria en tiempo real
  const sliderMeta = document.getElementById('slider-meta-diaria');
  if (sliderMeta) {
    sliderMeta.addEventListener('input', e => {
      const nuevaMeta = Number(e.target.value) || DEFAULT_CONFIG.metaDiaria;
      appData.config.metaDiaria = nuevaMeta;
      guardarDatos();
      const resumen = calcularResumenSesion(
        appData.sesionActual.viajes,
        appData.config,
        appData.sesionActual.tanqueadas,
        appData.sesionActual.gastos
      );
      renderMetaDiaria(resumen);
    });
  }

  // Modal de Viaje: guardar, cerrar, cancelar
  const formViaje = document.getElementById('form-viaje');
  if (formViaje) formViaje.addEventListener('submit', guardarViajeDesdeFormulario);

  const btnCerrarViaje = document.getElementById('btn-cerrar-modal-viaje');
  if (btnCerrarViaje) btnCerrarViaje.addEventListener('click', cerrarModalViaje);

  const btnCancelarViaje = document.getElementById('btn-cancelar-viaje');
  if (btnCancelarViaje) btnCancelarViaje.addEventListener('click', cerrarModalViaje);

  const modalViaje = document.getElementById('modal-viaje');
  if (modalViaje) {
    modalViaje.addEventListener('click', e => {
      if (e.target === modalViaje) cerrarModalViaje();
    });
  }

  // Modal de Tanqueada: guardar, cerrar, cancelar y autocalcular galones
  const formTanqueada = document.getElementById('form-tanqueada');
  if (formTanqueada) formTanqueada.addEventListener('submit', guardarTanqueadaDesdeFormulario);

  const btnCerrarTanqueada = document.getElementById('btn-cerrar-modal-tanqueada');
  if (btnCerrarTanqueada) btnCerrarTanqueada.addEventListener('click', cerrarModalTanqueada);

  const btnCancelarTanqueada = document.getElementById('btn-cancelar-tanqueada');
  if (btnCancelarTanqueada) btnCancelarTanqueada.addEventListener('click', cerrarModalTanqueada);

  const modalTanqueada = document.getElementById('modal-tanqueada');
  if (modalTanqueada) {
    modalTanqueada.addEventListener('click', e => {
      if (e.target === modalTanqueada) cerrarModalTanqueada();
    });
  }

  // Autocalcular galones sugeridos al escribir monto de tanqueada
  const inputMontoTanqueada = document.getElementById('tanqueadaMontoCOP');
  const inputGalonesTanqueada = document.getElementById('tanqueadaGalones');
  if (inputMontoTanqueada && inputGalonesTanqueada) {
    inputMontoTanqueada.addEventListener('input', () => {
      const monto = parseFloat(inputMontoTanqueada.value) || 0;
      const precioGalon = Number(appData.config.precioGalonCOP) || 16000;
      if (monto > 0 && precioGalon > 0) {
        inputGalonesTanqueada.placeholder = (monto / precioGalon).toFixed(2);
      }
    });
  }

  // Delegación de eventos para editar/eliminar viajes en la tabla de historial
  const tablaBody = document.getElementById('tabla-historial-body');
  if (tablaBody) {
    tablaBody.addEventListener('click', e => {
      const btnEditar = e.target.closest('.btn-editar-viaje');
      if (btnEditar) {
        editarViaje(btnEditar.dataset.id);
        return;
      }
      const btnEliminar = e.target.closest('.btn-eliminar-viaje');
      if (btnEliminar) {
        eliminarViaje(btnEliminar.dataset.id);
      }
    });
  }

  // Delegación de eventos para eliminar tanqueadas de la lista
  const listaTanqueadas = document.getElementById('lista-tanqueadas');
  if (listaTanqueadas) {
    listaTanqueadas.addEventListener('click', e => {
      const btnEliminarTanqueada = e.target.closest('.btn-eliminar-tanqueada');
      if (btnEliminarTanqueada) {
        eliminarTanqueada(btnEliminarTanqueada.dataset.id);
      }
    });
  }

  // Cerrar modales con tecla Escape
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      cerrarModalViaje();
      cerrarModalTanqueada();
      cerrarModalGasto();
    }
  });
}

// Exponer funciones CRUD en window por si se invocan desde atributos inline
window.editarViaje = editarViaje;
window.eliminarViaje = eliminarViaje;
window.eliminarTanqueada = eliminarTanqueada;

// ==========================================
// 8B. NOTIFICACIONES TOAST, CONFIRMACIÓN Y NAVEGACIÓN SPA (FASE 2)
// ==========================================

const TOAST_ICONOS = {
  info: 'info',
  success: 'check-circle-2',
  warning: 'alert-triangle',
  danger: 'x-circle'
};

function showToast(mensaje, tipo = 'info', duracion = 3000) {
  const contenedor = document.getElementById('toast-container');
  if (!contenedor) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${tipo}`;

  const icono = document.createElement('i');
  icono.setAttribute('data-lucide', TOAST_ICONOS[tipo] || 'info');

  const texto = document.createElement('span');
  texto.textContent = mensaje;

  toast.appendChild(icono);
  toast.appendChild(texto);
  contenedor.appendChild(toast);

  if (typeof lucide !== 'undefined' && typeof lucide.createIcons === 'function') {
    lucide.createIcons();
  }

  setTimeout(() => {
    toast.classList.add('toast-out');
    setTimeout(() => toast.remove(), 260);
  }, duracion);
}

function confirmDialog(mensaje, titulo = 'Confirmar') {
  return new Promise(resolver => {
    const modal = document.getElementById('modal-confirm');
    if (!modal) {
      resolver(false);
      return;
    }

    const elTitulo = document.getElementById('confirm-titulo');
    const elMensaje = document.getElementById('confirm-mensaje');
    const btnSi = document.getElementById('btn-confirm-si');
    const btnNo = document.getElementById('btn-confirm-no');
    const btnX = document.getElementById('btn-confirm-x');

    elTitulo.textContent = titulo;
    elMensaje.textContent = mensaje;

    const cerrar = resultado => {
      modal.classList.add('hidden');
      modal.setAttribute('aria-hidden', 'true');
      document.removeEventListener('keydown', onEscape);
      resolver(resultado);
    };

    const onEscape = e => {
      if (e.key === 'Escape') cerrar(false);
    };
    document.addEventListener('keydown', onEscape);

    // Asignación (no addEventListener) para evitar acumulación de handlers
    btnSi.onclick = () => cerrar(true);
    btnNo.onclick = () => cerrar(false);
    btnX.onclick = () => cerrar(false);

    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
  });
}

function inicializarNavegacion() {
  const nav = document.getElementById('bottom-nav');
  if (!nav) return;

  const itemsNav = Array.from(nav.querySelectorAll('.nav-item'));

  nav.addEventListener('click', evento => {
    const boton = evento.target.closest('.nav-item');
    if (!boton || !boton.dataset.view) return;

    const vista = `view-${boton.dataset.view}`;

    const indiceNuevo = itemsNav.indexOf(boton);
    const indiceAnterior = itemsNav.indexOf(nav.querySelector('.nav-item.active'));
    const claseEntrada = indiceNuevo >= indiceAnterior ? 'view-slide-left' : 'view-slide-right';

    nav.querySelectorAll('.nav-item').forEach(item => {
      item.classList.toggle('active', item === boton);
    });
    document.querySelectorAll('.app-view').forEach(vistaEl => {
      const esDestino = vistaEl.id === vista;
      vistaEl.classList.toggle('hidden', !esDestino);
      vistaEl.classList.remove('view-slide-left', 'view-slide-right');
      if (esDestino) {
        void vistaEl.offsetWidth; // reinicia la animación
        vistaEl.classList.add(claseEntrada);
      }
    });

    // Al abrir Historial, refrescar reportes y jornadas desde IndexedDB
    if (vista === 'view-historial') {
      refrescarAnalitica();
    }

    window.scrollTo(0, 0);
  });
}

// ==========================================
// 8E. ANALÍTICA MULTI-JORNADA Y FRANJAS HORARIAS (FASE 5)
// ==========================================

let periodoReporte = 'dia';
let cacheAnalitica = { jornadas: [], viajes: [], gastos: [] };
let chartFranjasInstance = null;

const FRANJAS_HORARIAS = [
  { etiqueta: '06–09', desde: 6, hasta: 9 },
  { etiqueta: '09–12', desde: 9, hasta: 12 },
  { etiqueta: '12–15', desde: 12, hasta: 15 },
  { etiqueta: '15–18', desde: 15, hasta: 18 },
  { etiqueta: '18–22', desde: 18, hasta: 22 },
  { etiqueta: '22–06', desde: 22, hasta: 30 }
];

function inicioDelDia(fecha) {
  const copia = new Date(fecha);
  copia.setHours(0, 0, 0, 0);
  return copia;
}

function rangoPeriodo(periodo) {
  const ahora = new Date();
  const inicioHoy = inicioDelDia(ahora);

  if (periodo === 'semana') {
    const inicio = new Date(inicioHoy.getTime() - 6 * 86400000);
    return {
      inicio,
      fin: ahora,
      inicioPrev: new Date(inicio.getTime() - 7 * 86400000),
      finPrev: inicio
    };
  }

  if (periodo === 'mes') {
    const inicio = new Date(inicioHoy.getTime() - 29 * 86400000);
    return {
      inicio,
      fin: ahora,
      inicioPrev: new Date(inicio.getTime() - 30 * 86400000),
      finPrev: inicio
    };
  }

  return {
    inicio: inicioHoy,
    fin: ahora,
    inicioPrev: new Date(inicioHoy.getTime() - 86400000),
    finPrev: inicioHoy
  };
}

function estaEnRango(timestamp, inicio, fin) {
  const fecha = new Date(timestamp);
  if (isNaN(fecha.getTime())) return false;
  return fecha >= inicio && fecha <= fin;
}

function indiceFranjaHora(hora) {
  if (hora >= 22 || hora < 6) return 5;
  return FRANJAS_HORARIAS.findIndex(franja => hora >= franja.desde && hora < franja.hasta);
}

function formatearFechaCorta(fecha) {
  return new Date(fecha).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
}

function agregarMetricas(viajes, gastos) {
  const calculados = viajes.map(v => calcularMetricasViaje(normalizarViajeDesdeDB(v)));
  const totalGanado = calculados.reduce((acc, v) => acc + v.precioCOP, 0);
  const tiempoTotalMin = calculados.reduce((acc, v) => acc + v.tTotal, 0);
  const distanciaTotalKm = calculados.reduce((acc, v) => acc + v.dTotal, 0);
  const mantenimiento = gastos.reduce((acc, g) => acc + (Number(g.montoCOP) || 0), 0);
  const precioGalon = Number(appData.config.precioGalonCOP) || 16000;
  const rendimiento = Number(appData.config.rendimientoGalonKm) || 40;
  const gastoGasolina = distanciaTotalKm * (precioGalon / rendimiento);

  return {
    totalCarreras: calculados.length,
    totalGanado,
    tiempoTotalMin,
    distanciaTotalKm,
    promHora: tiempoTotalMin > 0 ? totalGanado / (tiempoTotalMin / 60) : 0,
    gastoGasolina,
    mantenimiento,
    netoReal: totalGanado - gastoGasolina - mantenimiento
  };
}

function formatearDelta(actual, anterior) {
  if (!anterior) {
    return { texto: actual > 0 ? 'nuevo en el período' : '—', clase: actual > 0 ? 'positivo' : '' };
  }
  const porcentaje = ((actual - anterior) / anterior) * 100;
  const signo = porcentaje >= 0 ? '+' : '';
  return {
    texto: `${signo}${formatNum(porcentaje, 1)}% vs período anterior`,
    clase: porcentaje >= 0 ? 'positivo' : 'negativo'
  };
}

function aplicarDelta(id, actual, anterior) {
  const el = document.getElementById(id);
  if (!el) return;
  const delta = formatearDelta(actual, anterior);
  el.textContent = delta.texto;
  el.className = `report-delta ${delta.clase}`;
}

function renderReportes() {
  const { inicio, fin, inicioPrev, finPrev } = rangoPeriodo(periodoReporte);

  const viajesActual = cacheAnalitica.viajes.filter(v => estaEnRango(v.timestamp, inicio, fin));
  const gastosActual = cacheAnalitica.gastos.filter(g => estaEnRango(g.timestamp, inicio, fin));
  const viajesPrevio = cacheAnalitica.viajes.filter(v => estaEnRango(v.timestamp, inicioPrev, finPrev));
  const gastosPrevio = cacheAnalitica.gastos.filter(g => estaEnRango(g.timestamp, inicioPrev, finPrev));

  const actual = agregarMetricas(viajesActual, gastosActual);
  const previo = agregarMetricas(viajesPrevio, gastosPrevio);

  setText('report-bruto', formatCOP(actual.totalGanado));
  setText('report-neto', formatCOP(actual.netoReal));
  setText('report-hora', `${formatCOP(actual.promHora)}/h`);
  setText('report-viajes', String(actual.totalCarreras));

  aplicarDelta('report-bruto-delta', actual.totalGanado, previo.totalGanado);
  aplicarDelta('report-neto-delta', actual.netoReal, previo.netoReal);
  aplicarDelta('report-hora-delta', actual.promHora, previo.promHora);
  aplicarDelta('report-viajes-delta', actual.totalCarreras, previo.totalCarreras);

  const etiquetas = {
    dia: 'hoy',
    semana: 'últimos 7 días',
    mes: 'últimos 30 días'
  };
  setText(
    'report-rango',
    `Período: ${etiquetas[periodoReporte] || periodoReporte} · ${formatearFechaCorta(inicio)} – ${formatearFechaCorta(fin)}`
  );

  renderGraficoFranjas(viajesActual);
}

function renderGraficoFranjas(viajes) {
  const canvas = document.getElementById('chart-franjas');
  if (!canvas || typeof Chart === 'undefined') return;

  const acumulados = FRANJAS_HORARIAS.map(() => ({ precio: 0, tiempo: 0, carreras: 0 }));

  viajes.forEach(viaje => {
    const metricas = calcularMetricasViaje(normalizarViajeDesdeDB(viaje));
    const fecha = new Date(metricas.timestamp);
    if (isNaN(fecha.getTime())) return;
    const indice = indiceFranjaHora(fecha.getHours());
    if (indice < 0) return;
    acumulados[indice].precio += metricas.precioCOP;
    acumulados[indice].tiempo += metricas.tTotal;
    acumulados[indice].carreras += 1;
  });

  const labels = FRANJAS_HORARIAS.map(franja => franja.etiqueta);
  const valores = acumulados.map(a => (a.tiempo > 0 ? a.precio / (a.tiempo / 60) : 0));
  const metaHora = Number(appData.config.metaHora) || 30000;
  const colores = valores.map(valor =>
    valor >= metaHora ? '#10b981' : valor >= metaHora * 0.8 ? '#f59e0b' : '#ef4444'
  );

  const subtitulo = document.getElementById('franjas-sub');
  if (subtitulo) {
    if (viajes.length === 0) {
      subtitulo.textContent = 'Sin carreras en el período seleccionado.';
    } else {
      let mejorIndice = 0;
      valores.forEach((valor, indice) => {
        if (valor > valores[mejorIndice]) mejorIndice = indice;
      });
      subtitulo.textContent = `Mejor franja: ${labels[mejorIndice]} con ${formatCOP(
        valores[mejorIndice]
      )}/h · ${viajes.length} carreras analizadas`;
    }
  }

  if (chartFranjasInstance) {
    chartFranjasInstance.data.datasets[0].data = valores;
    chartFranjasInstance.data.datasets[0].backgroundColor = colores;
    chartFranjasInstance.data.datasets[1].data = labels.map(() => metaHora);
    chartFranjasInstance.options.scales.y.suggestedMax = Math.max(metaHora * 1.3, ...valores, 35000);
    chartFranjasInstance.update();
    return;
  }

  chartFranjasInstance = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          type: 'bar',
          label: 'COP / hora por franja',
          data: valores,
          backgroundColor: colores,
          borderRadius: 6,
          maxBarThickness: 44,
          order: 2
        },
        {
          type: 'line',
          label: `Meta (${formatCOP(metaHora)}/h)`,
          data: labels.map(() => metaHora),
          borderColor: '#ff6b00',
          borderWidth: 2,
          borderDash: [6, 4],
          pointRadius: 0,
          fill: false,
          order: 1
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          ticks: { color: '#94a3b8' },
          grid: { display: false }
        },
        y: {
          beginAtZero: true,
          suggestedMax: Math.max(metaHora * 1.3, ...valores, 35000),
          ticks: {
            color: '#94a3b8',
            callback: value => '$' + (value / 1000).toFixed(0) + 'k'
          },
          grid: { color: 'rgba(148, 163, 184, 0.12)' }
        }
      },
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: '#94a3b8', font: { size: 12 } }
        },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.dataset.label}: ${formatCOP(ctx.raw)}/h`
          }
        }
      }
    }
  });
}

function renderJornadasListado() {
  const contenedor = document.getElementById('lista-jornadas');
  if (!contenedor) return;

  const jornadas = cacheAnalitica.jornadas
    .slice()
    .sort((a, b) => String(b.fechaInicio || '').localeCompare(String(a.fechaInicio || '')));

  if (jornadas.length === 0) {
    contenedor.innerHTML = `<div class="empty-state" style="padding: 14px;">Aún no hay jornadas guardadas.</div>`;
    return;
  }

  contenedor.innerHTML = jornadas
    .map(jornada => {
      const viajes = cacheAnalitica.viajes
        .filter(v => v.jornadaId === jornada.id)
        .map(normalizarViajeDesdeDB);
      const gastos = cacheAnalitica.gastos.filter(g => g.jornadaId === jornada.id);
      const cerrada = jornada.estado === 'cerrada';

      // Las jornadas cerradas usan su resumen congelado (inmutable)
      const resumen =
        cerrada && jornada.resumen && typeof jornada.resumen.gananciaNetaReal === 'number'
          ? jornada.resumen
          : calcularResumenSesion(viajes, appData.config, [], gastos);

      const fin = jornada.fechaFin ? new Date(jornada.fechaFin) : new Date();
      const duracionMin = Math.max(0, (fin - new Date(jornada.fechaInicio)) / 60000);
      const nCarreras = resumen.totalCarreras ?? viajes.length;

      return `
        <article class="jornada-card ${cerrada ? 'jornada-cerrada' : 'jornada-activa'}">
          <header class="jornada-header">
            <div>
              <strong>${formatFechaCompleta(jornada.fechaInicio)}</strong>
              <small>${formatDuracion(duracionMin)} · ${nCarreras} ${nCarreras === 1 ? 'carrera' : 'carreras'}</small>
            </div>
            <span class="badge ${cerrada ? 'badge-neutral' : 'badge-success'}">
              ${cerrada ? 'Cerrada' : 'Activa'}
            </span>
          </header>
          <div class="jornada-metrics">
            <div><span>Bruto</span><strong>${formatCOP(resumen.totalGanado)}</strong></div>
            <div><span>Gasolina</span><strong>${formatCOP(resumen.gastoGasolinaEstimado)}</strong></div>
            <div><span>Mantenimiento</span><strong>${formatCOP(resumen.totalMantenimiento)}</strong></div>
            <div><span>Neto real</span><strong class="text-success">${formatCOP(resumen.gananciaNetaReal)}</strong></div>
            <div><span>COP/h</span><strong>${formatCOP(resumen.promHora)}</strong></div>
          </div>
        </article>
      `;
    })
    .join('');
}

async function refrescarAnalitica() {
  if (typeof DidiDB === 'undefined') return;
  try {
    const [jornadas, viajes, gastos] = await Promise.all([
      DidiDB.obtenerJornadas(),
      DidiDB.obtenerTodosViajes(),
      DidiDB.obtenerTodosGastos()
    ]);
    cacheAnalitica = {
      jornadas: jornadas || [],
      viajes: viajes || [],
      gastos: gastos || []
    };
    renderReportes();
    renderJornadasListado();
  } catch (error) {
    console.warn('DIDI Tracker: no se pudo cargar la analítica:', error.message);
  }
}

function configurarReportes() {
  const tabs = document.getElementById('report-tabs');
  if (tabs) {
    tabs.addEventListener('click', evento => {
      const boton = evento.target.closest('.report-tab');
      if (!boton) return;
      periodoReporte = boton.dataset.periodo || 'dia';
      tabs.querySelectorAll('.report-tab').forEach(b => b.classList.toggle('active', b === boton));
      renderReportes();
    });
  }
}

function sincronizarAjustesConfig() {
  const costo = document.getElementById('configCostoAceite');
  const intervalo = document.getElementById('configIntervaloAceite');
  if (costo) costo.value = Number(appData.config.costoAceiteCOP) || 200000;
  if (intervalo) intervalo.value = Number(appData.config.intervaloAceiteKm) || 5000;
}

function configurarAjustesCostos() {
  const costo = document.getElementById('configCostoAceite');
  const intervalo = document.getElementById('configIntervaloAceite');

  if (costo) {
    costo.addEventListener('change', () => {
      appData.config.costoAceiteCOP = Math.max(0, parseFloat(costo.value) || 0);
      guardarDatos();
      showToast('Costo de aceite actualizado.', 'success');
    });
  }

  if (intervalo) {
    intervalo.addEventListener('change', () => {
      appData.config.intervaloAceiteKm = Math.max(0, parseFloat(intervalo.value) || 0);
      guardarDatos();
      showToast('Intervalo de aceite actualizado.', 'success');
    });
  }

  sincronizarAjustesConfig();
}

// ==========================================
// 8D. AUDIO SINTÉTICO, MODO RÁPIDO Y CALCULADORA (FASE 4)
// ==========================================

// --- Motor de audio sintético (Web Audio API, sin archivos MP3) ---
let audioCtx = null;

function obtenerAudioContext() {
  if (audioCtx) {
    if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
    return audioCtx;
  }
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) return null;
  try {
    audioCtx = new Ctor();
  } catch (error) {
    return null;
  }
  if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
  return audioCtx;
}

// Desbloquea el AudioContext en el primer gesto real del usuario
function desbloquearAudio() {
  const ctx = obtenerAudioContext();
  if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
}

function programarTono(ctx, { frecuenciaInicial, frecuenciaFinal, inicio, duracion, ganancia = 0.16 }) {
  const oscilador = ctx.createOscillator();
  const envolvente = ctx.createGain();

  oscilador.type = 'sine';
  oscilador.frequency.setValueAtTime(frecuenciaInicial, inicio);
  if (frecuenciaFinal && frecuenciaFinal !== frecuenciaInicial) {
    oscilador.frequency.exponentialRampToValueAtTime(frecuenciaFinal, inicio + duracion);
  }

  // Envolvente suave para evitar clics
  envolvente.gain.setValueAtTime(0.0001, inicio);
  envolvente.gain.exponentialRampToValueAtTime(ganancia, inicio + 0.012);
  envolvente.gain.exponentialRampToValueAtTime(0.0001, inicio + duracion);

  oscilador.connect(envolvente).connect(ctx.destination);
  oscilador.start(inicio);
  oscilador.stop(inicio + duracion + 0.03);
}

/**
 * Reproduce el tono del semáforo:
 *  - verde:    dual agudo ascendente 880 → 1200 Hz (120 ms)
 *  - amarillo: neutro estable 660 Hz (150 ms)
 *  - rojo:     grave descendente 330 → 220 Hz (200 ms)
 */
function reproducirTono(semaforo) {
  if (appData?.config?.audioSilenciado) return false;

  const ctx = obtenerAudioContext();
  if (!ctx) return false;

  const ahora = ctx.currentTime + 0.02;

  if (semaforo === 'verde') {
    programarTono(ctx, {
      frecuenciaInicial: 880,
      frecuenciaFinal: 1200,
      inicio: ahora,
      duracion: 0.12,
      ganancia: 0.14
    });
    programarTono(ctx, {
      frecuenciaInicial: 880,
      frecuenciaFinal: 1200,
      inicio: ahora + 0.07,
      duracion: 0.08,
      ganancia: 0.09
    });
  } else if (semaforo === 'amarillo') {
    programarTono(ctx, {
      frecuenciaInicial: 660,
      frecuenciaFinal: 660,
      inicio: ahora,
      duracion: 0.15,
      ganancia: 0.14
    });
  } else {
    programarTono(ctx, {
      frecuenciaInicial: 330,
      frecuenciaFinal: 220,
      inicio: ahora,
      duracion: 0.2,
      ganancia: 0.17
    });
  }

  // Hook de diagnóstico para pruebas automatizadas
  window.__ultimoTono = {
    semaforo,
    iniciadoEn: new Date().toISOString(),
    estadoAudio: ctx.state
  };
  return true;
}

function actualizarBotonAudio() {
  const boton = document.getElementById('btn-toggle-audio');
  if (!boton) return;

  const silenciado = !!appData?.config?.audioSilenciado;
  boton.setAttribute('aria-pressed', silenciado ? 'true' : 'false');
  boton.setAttribute('aria-label', silenciado ? 'Activar sonidos' : 'Silenciar sonidos');
  boton.setAttribute('title', silenciado ? 'Activar sonidos' : 'Silenciar sonidos');
  boton.classList.toggle('muted', silenciado);
  boton.innerHTML = `<i data-lucide="${silenciado ? 'volume-x' : 'volume-2'}"></i><span>Audio</span>`;

  if (typeof lucide !== 'undefined' && typeof lucide.createIcons === 'function') {
    lucide.createIcons();
  }
}

function alternarAudio() {
  appData.config.audioSilenciado = !appData.config.audioSilenciado;
  actualizarBotonAudio();
  guardarDatos();

  if (appData.config.audioSilenciado) {
    showToast('Sonidos silenciados.', 'info');
  } else {
    showToast('Sonidos activados.', 'success');
    reproducirTono('amarillo');
  }
}

// --- Modo Rápido vs Desglose Detallado en el formulario de viaje ---
let modoFormularioViaje = 'rapido';

const CAMPOS_RAPIDOS = ['rapidoDistanciaKm', 'rapidoTiempoMin', 'rapidoPrecioCOP'];
const CAMPOS_DETALLADOS = [
  'distRecogidaKm',
  'tiempoRecogidaMin',
  'distEntregaKm',
  'tiempoEntregaMin',
  'precioCOP'
];

function aplicarModoFormularioViaje(modo) {
  modoFormularioViaje = modo === 'detallado' ? 'detallado' : 'rapido';

  const rapidos = document.getElementById('campos-rapidos');
  const detallados = document.getElementById('campos-detallados');
  if (rapidos) rapidos.classList.toggle('hidden', modoFormularioViaje !== 'rapido');
  if (detallados) detallados.classList.toggle('hidden', modoFormularioViaje !== 'detallado');

  document.querySelectorAll('.form-mode-toggle .mode-btn').forEach(boton => {
    const activo = boton.dataset.modo === modoFormularioViaje;
    boton.classList.toggle('active', activo);
    boton.setAttribute('aria-selected', activo ? 'true' : 'false');
  });

  CAMPOS_RAPIDOS.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.required = modoFormularioViaje === 'rapido';
  });
  CAMPOS_DETALLADOS.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.required = modoFormularioViaje === 'detallado';
  });

  // Preserva lo ya escrito al alternar entre modos
  if (modoFormularioViaje === 'rapido') {
    sincronizarCamposRapidosDesdeDetallados();
  } else {
    sincronizarDetalladosDesdeRapidos();
  }
}

function sincronizarCamposRapidosDesdeDetallados() {
  const leer = id => parseFloat(document.getElementById(id)?.value) || 0;
  const distancia = leer('distRecogidaKm') + leer('distEntregaKm');
  const tiempo = leer('tiempoRecogidaMin') + leer('tiempoEntregaMin');
  const precio = leer('precioCOP');

  const distEl = document.getElementById('rapidoDistanciaKm');
  const tiempoEl = document.getElementById('rapidoTiempoMin');
  const precioEl = document.getElementById('rapidoPrecioCOP');

  if (distEl && !distEl.value && distancia > 0) distEl.value = Number(distancia.toFixed(2));
  if (tiempoEl && !tiempoEl.value && tiempo > 0) tiempoEl.value = Number(tiempo.toFixed(0));
  if (precioEl && !precioEl.value && precio > 0) precioEl.value = Number(precio.toFixed(0));
}

function sincronizarDetalladosDesdeRapidos() {
  const leer = id => parseFloat(document.getElementById(id)?.value) || 0;
  const distancia = leer('rapidoDistanciaKm');
  const tiempo = leer('rapidoTiempoMin');
  const precio = leer('rapidoPrecioCOP');

  const distEntrega = document.getElementById('distEntregaKm');
  const tiempoEntrega = document.getElementById('tiempoEntregaMin');
  const precioDetallado = document.getElementById('precioCOP');

  if (distEntrega && !distEntrega.value && distancia > 0) distEntrega.value = Number(distancia.toFixed(2));
  if (tiempoEntrega && !tiempoEntrega.value && tiempo > 0) tiempoEntrega.value = Number(tiempo.toFixed(0));
  if (precioDetallado && !precioDetallado.value && precio > 0) precioDetallado.value = Number(precio.toFixed(0));
}

// --- Calculadora rápida pre-viaje ---
let campoCalculadoraActivo = 'calcDistanciaKm';

function obtenerValoresCalculadora() {
  const leer = id => Math.max(0, parseFloat(document.getElementById(id)?.value) || 0);
  return {
    distanciaKm: leer('calcDistanciaKm'),
    tiempoMin: leer('calcTiempoMin'),
    precioCOP: leer('calcPrecioCOP')
  };
}

function evaluarCalculadora({ emitirSonido = false } = {}) {
  const { distanciaKm, tiempoMin, precioCOP } = obtenerValoresCalculadora();

  const tarjeta = document.getElementById('calc-resultado');
  const badge = document.getElementById('calc-badge');
  const veredicto = document.getElementById('calc-veredicto');
  const metaHoraEl = document.getElementById('calc-meta-hora');
  const metaKmEl = document.getElementById('calc-meta-km');

  if (metaHoraEl) metaHoraEl.textContent = `Meta: ${formatCOP(appData.config.metaHora)} /h`;
  if (metaKmEl) metaKmEl.textContent = `Meta: ${formatCOP(appData.config.metaKm)} /km`;

  const valido = distanciaKm > 0 && tiempoMin > 0 && precioCOP > 0;

  if (!valido) {
    const copHoraEl = document.getElementById('calc-cop-hora');
    const copKmEl = document.getElementById('calc-cop-km');
    if (copHoraEl) copHoraEl.textContent = `${formatCOP(0)} /h`;
    if (copKmEl) copKmEl.textContent = `${formatCOP(0)} /km`;
    if (tarjeta) tarjeta.classList.remove('calc-verde', 'calc-amarillo', 'calc-rojo');
    if (badge) {
      badge.textContent = 'Sin evaluar';
      badge.className = 'badge badge-neutral';
    }
    if (veredicto) {
      veredicto.textContent = 'Ingresa distancia, tiempo y valor para evaluar la propuesta.';
    }
    return null;
  }

  const metricas = calcularMetricasViaje({
    id: 'calc',
    timestamp: new Date().toISOString(),
    distRecogidaKm: 0,
    tiempoRecogidaMin: 0,
    distEntregaKm: distanciaKm,
    tiempoEntregaMin: tiempoMin,
    precioCOP,
    metodoPago: 'Efectivo'
  });

  const copHoraEl = document.getElementById('calc-cop-hora');
  const copKmEl = document.getElementById('calc-cop-km');
  if (copHoraEl) copHoraEl.textContent = `${formatCOP(metricas.copHora)} /h`;
  if (copKmEl) copKmEl.textContent = `${formatCOP(metricas.copKm)} /km`;

  if (tarjeta) {
    tarjeta.classList.remove('calc-verde', 'calc-amarillo', 'calc-rojo');
    tarjeta.classList.add(`calc-${metricas.semaforo}`);
  }

  if (badge) {
    badge.textContent = metricas.etiquetaSemaforo;
    const clase =
      metricas.semaforo === 'verde'
        ? 'badge-success'
        : metricas.semaforo === 'amarillo'
        ? 'badge-warning'
        : 'badge-danger';
    badge.className = `badge ${clase}`;
  }

  if (veredicto) {
    const metaHora = Number(appData.config.metaHora) || 30000;
    const metaKm = Number(appData.config.metaKm) || 2000;
    const cumpleHora = metricas.copHora >= metaHora;
    const cumpleKm = metricas.copKm >= metaKm;
    veredicto.textContent = `${metricas.etiquetaSemaforo}: ${
      cumpleHora ? 'cumple' : 'no cumple'
    } la meta por hora y ${cumpleKm ? 'cumple' : 'no cumple'} la meta por km.`;
  }

  if (emitirSonido) reproducirTono(metricas.semaforo);
  return metricas;
}

function limpiarCalculadora() {
  ['calcDistanciaKm', 'calcTiempoMin', 'calcPrecioCOP'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  evaluarCalculadora();
}

function aceptarYRegistrarCalculadora() {
  const { distanciaKm, tiempoMin, precioCOP } = obtenerValoresCalculadora();

  if (distanciaKm <= 0 || tiempoMin <= 0 || precioCOP <= 0) {
    showToast('Completa distancia, tiempo y valor para registrar la carrera.', 'warning');
    return;
  }

  asegurarJornadaActiva().then(activa => {
    if (!activa) return;

    const nuevoViaje = {
      id: generarId(),
      timestamp: new Date().toISOString(),
      distRecogidaKm: 0,
      tiempoRecogidaMin: 0,
      distEntregaKm: distanciaKm,
      tiempoEntregaMin: tiempoMin,
      precioCOP,
      metodoPago: 'Efectivo'
    };

    appData.sesionActual.viajes.push(nuevoViaje);
    guardarDatos();
    renderDashboard();

    const metricas = calcularMetricasViaje(nuevoViaje);
    reproducirTono(metricas.semaforo);

    const tipoToast =
      metricas.semaforo === 'verde' ? 'success' : metricas.semaforo === 'amarillo' ? 'warning' : 'danger';
    showToast(
      `Carrera registrada: ${formatCOP(precioCOP)} · ${metricas.etiquetaSemaforo}.`,
      tipoToast,
      4000
    );

    limpiarCalculadora();
  });
}

function inicializarCalculadora() {
  ['calcDistanciaKm', 'calcTiempoMin', 'calcPrecioCOP'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('focus', () => {
      campoCalculadoraActivo = id;
    });
    el.addEventListener('input', () => evaluarCalculadora());
  });

  const keypad = document.getElementById('calc-keypad');
  if (keypad) {
    keypad.addEventListener('click', evento => {
      const boton = evento.target.closest('button[data-key]');
      if (!boton) return;
      const clave = boton.dataset.key;
      const input = document.getElementById(campoCalculadoraActivo);
      if (!input) return;

      if (clave === 'borrar') {
        input.value = input.value.slice(0, -1);
      } else if (clave === '.') {
        if (!input.value.includes('.')) input.value += '.';
      } else {
        input.value += clave;
      }

      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.focus();
    });
  }

  const btnAceptar = document.getElementById('btn-calc-aceptar');
  if (btnAceptar) btnAceptar.addEventListener('click', aceptarYRegistrarCalculadora);

  const btnLimpiar = document.getElementById('btn-calc-limpiar');
  if (btnLimpiar) btnLimpiar.addEventListener('click', limpiarCalculadora);

  evaluarCalculadora();
}

// ==========================================
// 8C. RESPALDO JSON / GOOGLE DRIVE (FASE 3)
// ==========================================

async function actualizarEstadoAlmacenamiento() {
  if (typeof DidiDB === 'undefined') return;
  try {
    const conteo = await DidiDB.contarRegistros();
    const setStat = (id, valor) => {
      const el = document.getElementById(id);
      if (el) el.textContent = String(valor);
    };
    setStat('db-stat-jornadas', conteo.jornadas);
    setStat('db-stat-viajes', conteo.viajes);
    setStat('db-stat-tanqueadas', conteo.tanqueadas);
    setStat('db-stat-gastos', conteo.gastosPuntuales);
  } catch (error) {
    console.warn('DIDI Tracker: no se pudo leer el estado de IndexedDB:', error.message);
  }
}

/**
 * Flujo de respaldo:
 * 1. Móvil: Web Share API → permite guardar directo en Google Drive/WhatsApp.
 * 2. PC Chromium: File System Access API → elegir carpeta.
 * 3. Fallback universal: descarga tradicional del archivo.
 */
async function exportarRespaldo() {
  if (typeof DidiDB === 'undefined') {
    showToast('IndexedDB no está disponible en este navegador.', 'danger');
    return;
  }

  try {
    const flush = persistirEnIndexedDB();
    if (flush) await flush;

    const datos = await DidiDB.exportarTodo();
    const nombre = `didi_backup_${new Date().toISOString().slice(0, 10)}.json`;
    const json = JSON.stringify(datos, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const archivo = new File([blob], nombre, { type: 'application/json' });

    // 1) Web Share API (móvil → menú de compartir, incluye Google Drive)
    if (navigator.canShare && navigator.canShare({ files: [archivo] })) {
      try {
        await navigator.share({
          files: [archivo],
          title: 'Respaldo DIDI Pro',
          text: 'Respaldo de datos de DIDI Tracker'
        });
        showToast('Respaldo compartido. Guárdalo en Google Drive.', 'success');
        return;
      } catch (error) {
        if (error.name === 'AbortError') {
          showToast('Envío del respaldo cancelado.', 'info');
          return;
        }
        // Si falla el share, continuar con los otros métodos
      }
    }

    // 2) File System Access API (PC Chromium → elegir carpeta)
    if (typeof window.showSaveFilePicker === 'function') {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: nombre,
          types: [{ description: 'Respaldo JSON', accept: { 'application/json': ['.json'] } }]
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        showToast('Respaldo guardado en la carpeta elegida.', 'success');
        return;
      } catch (error) {
        if (error.name === 'AbortError') {
          showToast('Guardado del respaldo cancelado.', 'info');
          return;
        }
        // Si el picker no está disponible, usar descarga
      }
    }

    // 3) Descarga universal
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = nombre;
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast('Respaldo descargado. Súbelo a tu Google Drive.', 'success');
  } catch (error) {
    showToast('No se pudo exportar el respaldo: ' + error.message, 'danger', 5000);
  }
}

async function importarRespaldo(archivo) {
  if (typeof DidiDB === 'undefined') {
    showToast('IndexedDB no está disponible en este navegador.', 'danger');
    return;
  }

  try {
    const texto = await archivo.text();
    const datos = JSON.parse(texto);
    const restaurado = await DidiDB.importarTodo(datos);

    await cargarDatos();
    renderDashboard();
    actualizarEstadoAlmacenamiento();
    sincronizarAjustesConfig();
    refrescarAnalitica();
    guardarDatos();

    showToast(
      `Respaldo restaurado: ${restaurado.jornadas} jornadas, ${restaurado.viajes} viajes.`,
      'success',
      4500
    );
  } catch (error) {
    showToast('No se pudo restaurar el respaldo: ' + error.message, 'danger', 5000);
  }
}

function configurarRespaldo() {
  const btnExportar = document.getElementById('btn-exportar-respaldo');
  const btnImportar = document.getElementById('btn-importar-respaldo');
  const inputImportar = document.getElementById('input-importar-respaldo');

  if (btnExportar) btnExportar.addEventListener('click', exportarRespaldo);

  if (btnImportar && inputImportar) {
    btnImportar.addEventListener('click', () => inputImportar.click());
    inputImportar.addEventListener('change', () => {
      const archivo = inputImportar.files && inputImportar.files[0];
      if (archivo) importarRespaldo(archivo);
      inputImportar.value = '';
    });
  }
}

// ==========================================
// 9. INSTALACIÓN PWA
// ==========================================
const INSTALL_BANNER_KEY = 'didi_install_banner_dismissed';
let deferredInstallPrompt = null;

function esModoStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: minimal-ui)').matches ||
    window.navigator.standalone === true
  );
}

function esIOS() {
  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

function actualizarUIInstalacion() {
  const boton = document.getElementById('btn-instalar-app');
  const estado = document.getElementById('install-estado');
  const hint = document.getElementById('install-hint');
  const banner = document.getElementById('install-banner');
  const yaInstalada = esModoStandalone();

  if (yaInstalada) {
    if (estado) estado.textContent = 'DIDI Pro ya está instalada y se abre como aplicación.';
    if (boton) boton.classList.add('hidden');
    if (banner) banner.classList.add('hidden');
    if (hint) hint.textContent = 'Puedes abrirla desde el icono en la pantalla de inicio.';
    return;
  }

  if (boton) boton.classList.remove('hidden');

  if (deferredInstallPrompt) {
    if (estado) {
      estado.textContent =
        'Instala DIDI Pro en tu teléfono para abrirla como app, sin barra del navegador y con acceso offline.';
    }
    if (hint) hint.textContent = 'El instalador del navegador se abrirá con un toque.';
  } else if (esIOS()) {
    if (estado) estado.textContent = 'En iPhone se instala desde Safari con dos toques.';
    if (hint) hint.textContent = 'Toca el botón y sigue los pasos.';
  } else {
    if (estado) {
      estado.textContent =
        'Abre esta página en Chrome (Android) o Safari (iPhone) para instalarla como aplicación.';
    }
    if (hint) hint.textContent = 'Si no ves el instalador, usa el menú del navegador → Instalar aplicación.';
  }

  const bannerDescartado = localStorage.getItem(INSTALL_BANNER_KEY) === '1';
  if (banner) {
    banner.classList.toggle('hidden', bannerDescartado || !(deferredInstallPrompt || esIOS()));
  }
}

async function instalarApp() {
  if (esModoStandalone()) return;

  if (deferredInstallPrompt) {
    deferredInstallPrompt.prompt();
    const eleccion = await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    if (eleccion && eleccion.outcome === 'accepted') {
      showToast('Instalando DIDI Pro…', 'success');
    }
    actualizarUIInstalacion();
    return;
  }

  abrirModalInstalar();
}

function abrirModalInstalar() {
  const modal = document.getElementById('modal-instalar');
  const pasos = document.getElementById('install-pasos');
  if (!modal || !pasos) return;

  if (esIOS()) {
    pasos.innerHTML = `
      <ol class="install-pasos">
        <li>Abre esta página en <strong>Safari</strong>.</li>
        <li>Toca el botón <strong>Compartir</strong> (cuadrado con flecha).</li>
        <li>Elige <strong>Añadir a pantalla de inicio</strong>.</li>
        <li>Confirma con <strong>Añadir</strong>.</li>
      </ol>
      <p class="settings-hint">En iPhone, la instalación solo está disponible desde Safari.</p>`;
  } else {
    pasos.innerHTML = `
      <ol class="install-pasos">
        <li>Abre el menú <strong>⋮</strong> de Chrome.</li>
        <li>Toca <strong>Instalar aplicación</strong> o <strong>Añadir a pantalla de inicio</strong>.</li>
        <li>Confirma con <strong>Instalar</strong>.</li>
      </ol>
      <p class="settings-hint">Si no aparece la opción, recarga la página y espera unos segundos.</p>`;
  }

  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
}

function configurarInstalacionPWA() {
  const boton = document.getElementById('btn-instalar-app');
  const bannerBoton = document.getElementById('btn-banner-instalar');
  const cerrarBanner = document.getElementById('btn-cerrar-banner');
  const modal = document.getElementById('modal-instalar');
  const cerrarModal = document.getElementById('btn-cerrar-modal-instalar');
  const entendido = document.getElementById('btn-cerrar-instalar');

  window.addEventListener('beforeinstallprompt', evento => {
    evento.preventDefault();
    deferredInstallPrompt = evento;
    actualizarUIInstalacion();
  });

  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    localStorage.removeItem(INSTALL_BANNER_KEY);
    showToast('DIDI Pro instalada correctamente.', 'success');
    actualizarUIInstalacion();
  });

  [boton, bannerBoton].forEach(elemento => {
    if (elemento) elemento.addEventListener('click', instalarApp);
  });

  if (cerrarBanner) {
    cerrarBanner.addEventListener('click', () => {
      localStorage.setItem(INSTALL_BANNER_KEY, '1');
      const banner = document.getElementById('install-banner');
      if (banner) banner.classList.add('hidden');
    });
  }

  const cerrar = () => {
    if (!modal) return;
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
  };
  [cerrarModal, entendido].forEach(elemento => {
    if (elemento) elemento.addEventListener('click', cerrar);
  });
  if (modal) {
    modal.addEventListener('click', evento => {
      if (evento.target === modal) cerrar();
    });
  }

  actualizarUIInstalacion();
}

// ==========================================
// 10. INICIALIZACIÓN DE LA APLICACIÓN
// ==========================================

// Registro del Service Worker (PWA offline) con control de ciclo de vida
function registrarServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  // Evitar error de seguridad al abrir directamente desde file://
  if (location.protocol !== 'http:' && location.protocol !== 'https:') return;

  navigator.serviceWorker.register('./sw.js').then(registration => {
    // Control de ciclo de vida: detectar nueva versión disponible
    registration.addEventListener('updatefound', () => {
      const nuevoWorker = registration.installing;
      if (!nuevoWorker) return;
      nuevoWorker.addEventListener('statechange', () => {
        if (nuevoWorker.state === 'installed' && navigator.serviceWorker.controller) {
          // Hay una nueva versión lista; activarla de inmediato
          nuevoWorker.postMessage({ type: 'SKIP_WAITING' });
        }
      });
    });
  }).catch(error => {
    console.warn('DIDI Tracker: registro de Service Worker falló:', error.message);
  });

  // Al activarse una nueva versión del SW, recargar para evitar servir
  // HTML/JS desactualizados mezclados con la nueva lógica de datos.
  // Solo si ya existía un SW controlando (no en la primera instalación).
  const habiaControladorInicial = !!navigator.serviceWorker.controller;
  let recargandoPorSW = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!habiaControladorInicial || recargandoPorSW) return;
    recargandoPorSW = true;
    window.location.reload();
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  await cargarDatos();
  configurarEventListeners();
  configurarRespaldo();
  configurarReportes();
  configurarAjustesCostos();
  configurarInstalacionPWA();
  inicializarNavegacion();
  inicializarCalculadora();
  aplicarModoFormularioViaje('rapido');
  actualizarBotonAudio();
  renderDashboard();
  actualizarEstadoAlmacenamiento();

  // Atajos del manifest: abrir la vista indicada por ?view=
  const vistaSolicitada = new URLSearchParams(window.location.search).get('view');
  const vistasValidas = ['turno', 'calculadora', 'historial', 'ajustes'];
  if (vistaSolicitada && vistasValidas.includes(vistaSolicitada)) {
    const botonVista = document.querySelector(`.nav-item[data-view="${vistaSolicitada}"]`);
    if (botonVista) botonVista.click();
  }

  // Desbloqueo del AudioContext en el primer gesto real del usuario
  ['pointerdown', 'keydown'].forEach(evento => {
    document.addEventListener(evento, desbloquearAudio, { once: true, passive: true });
  });

  if (typeof lucide !== 'undefined' && typeof lucide.createIcons === 'function') {
    lucide.createIcons();
  }
  registrarServiceWorker();
});
