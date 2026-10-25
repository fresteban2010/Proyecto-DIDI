/**
 * DIDI TRACKER - Lógica Principal de la Aplicación (app.js)
 * Gestión de viajes, métricas de rentabilidad, combustible, gráficos y persistencia.
 */

const STORAGE_KEY = 'didi_tracker_data';

// SVG oficial del isotipo D-Gauge (Tacómetro + Flecha Financiera Ascendente)
const BRAND_LOGO_SVG = `
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M4.93 19.07A10 10 0 1 1 19.07 4.93" stroke="#FFFFFF" stroke-width="2.4" stroke-linecap="round"/>
    <path d="M19.07 19.07A10 10 0 0 0 21.5 13.5" stroke="#FFFFFF" stroke-opacity="0.45" stroke-width="2.4" stroke-linecap="round"/>
    <path d="M11 13L17.5 6.5M17.5 6.5H13.5M17.5 6.5V10.5" stroke="#FFFFFF" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="10.5" cy="13.5" r="2" fill="#FFFFFF"/>
  </svg>
`.trim();

// Configuración por defecto solicitada
const DEFAULT_CONFIG = {
  metaHora: 30000,
  metaKm: 2000,
  rendimientoGalonKm: 40,
  precioGalonCOP: 16000,
  metaDiaria: 150000,
  tarifaMinimaBonus: 8500
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
// 2. PERSISTENCIA EN LOCALSTORAGE
// ==========================================

function cargarDatos() {
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
        fechaInicio: parsed.sesionActual?.fechaInicio || new Date().toISOString(),
        viajes: Array.isArray(parsed.sesionActual?.viajes) ? parsed.sesionActual.viajes : [],
        tanqueadas: Array.isArray(parsed.sesionActual?.tanqueadas) ? parsed.sesionActual.tanqueadas : []
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
      fechaInicio: new Date().toISOString(),
      viajes: [],
      tanqueadas: []
    }
  };
  guardarDatos();
}

function guardarDatos() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
  } catch (error) {
    console.error('Error al guardar en localStorage:', error);
  }
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
  tanqueadas = appData.sesionActual.tanqueadas
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
    totalGalonesTanqueados
  };
}

// ==========================================
// 4. RENDERIZADO DEL DASHBOARD
// ==========================================

/**
 * Garantiza que el contenedor .brand-logo mantenga siempre el isotipo SVG
 * personalizado D-Gauge y no dependa de ningún icono de Lucide Icons.
 */
function renderLogoMarca() {
  const brandLogoEl = document.querySelector('.brand-logo');
  if (!brandLogoEl) return;

  const tieneIconoLucide = brandLogoEl.querySelector('[data-lucide]');
  const tieneSvg = brandLogoEl.querySelector('svg');

  if (tieneIconoLucide || !tieneSvg) {
    brandLogoEl.innerHTML = BRAND_LOGO_SVG;
  }
}

function renderDashboard() {
  renderLogoMarca();

  const resumen = calcularResumenSesion(
    appData.sesionActual.viajes,
    appData.config,
    appData.sesionActual.tanqueadas
  );

  renderEstadoJornada(resumen);
  renderUltimoViaje(resumen);
  renderResumenSesion(resumen);
  renderMetaDiaria(resumen);
  renderGraficos(resumen);
  renderSeccionGasolina(resumen);
  renderTablaHistorial(resumen);

  if (typeof lucide !== 'undefined' && typeof lucide.createIcons === 'function') {
    lucide.createIcons();
  }
}

function renderEstadoJornada(resumen) {
  const elEstado = document.getElementById('estado-jornada');
  if (!elEstado) return;

  const fechaTexto = formatFechaCompleta(appData.sesionActual.fechaInicio);
  const nCarreras = resumen.totalCarreras;
  elEstado.textContent = `Jornada activa desde ${fechaTexto} • ${nCarreras} ${nCarreras === 1 ? 'carrera' : 'carreras'}`;
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
  setText('gas-ganancia-neta', formatCOP(resumen.gananciaNeta));
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
  if (inputDistRec) setTimeout(() => inputDistRec.focus(), 50);
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
  const distRecogidaKm = parseFloat(document.getElementById('distRecogidaKm')?.value) || 0;
  const tiempoRecogidaMin = parseFloat(document.getElementById('tiempoRecogidaMin')?.value) || 0;
  const distEntregaKm = parseFloat(document.getElementById('distEntregaKm')?.value) || 0;
  const tiempoEntregaMin = parseFloat(document.getElementById('tiempoEntregaMin')?.value) || 0;
  const precioCOP = parseFloat(document.getElementById('precioCOP')?.value) || 0;

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
  showToast(
    idExistente ? 'Carrera actualizada correctamente.' : 'Carrera registrada correctamente.',
    'success'
  );
}

function abrirModalTanqueada() {
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
  const viaje = appData.sesionActual.viajes.find(v => v.id === id);
  if (!viaje) return;
  abrirModalViaje(viaje);
}

function eliminarViaje(id) {
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
  confirmDialog('¿Deseas eliminar este registro de tanqueada?', 'Eliminar tanqueada').then(confirmar => {
    if (!confirmar) return;
    appData.sesionActual.tanqueadas = appData.sesionActual.tanqueadas.filter(t => t.id !== id);
    guardarDatos();
    renderDashboard();
    showToast('Registro de tanqueada eliminado.', 'info');
  });
}

function reiniciarJornada() {
  const tieneDatos =
    appData.sesionActual.viajes.length > 0 || appData.sesionActual.tanqueadas.length > 0;

  const mensaje = tieneDatos
    ? '¿Estás seguro de iniciar una nueva jornada? Se borrarán los viajes y tanqueadas de la sesión actual.'
    : '¿Deseas reiniciar el contador de inicio de la jornada actual?';

  confirmDialog(mensaje, 'Iniciar / Reiniciar Jornada').then(confirmar => {
    if (!confirmar) return;

    appData.sesionActual = {
      fechaInicio: new Date().toISOString(),
      viajes: [],
      tanqueadas: []
    };

    guardarDatos();
    renderDashboard();
    showToast('Nueva jornada iniciada.', 'success');
  });
}

function exportarCSV() {
  const resumen = calcularResumenSesion(
    appData.sesionActual.viajes,
    appData.config,
    appData.sesionActual.tanqueadas
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

  const btnAbrirViaje = document.getElementById('btn-abrir-modal-viaje');
  if (btnAbrirViaje) btnAbrirViaje.addEventListener('click', () => abrirModalViaje(null));

  const btnAbrirTanqueada = document.getElementById('btn-abrir-modal-tanqueada');
  if (btnAbrirTanqueada) btnAbrirTanqueada.addEventListener('click', abrirModalTanqueada);

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
        appData.sesionActual.tanqueadas
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

  nav.addEventListener('click', evento => {
    const boton = evento.target.closest('.nav-item');
    if (!boton || !boton.dataset.view) return;

    const vista = `view-${boton.dataset.view}`;

    nav.querySelectorAll('.nav-item').forEach(item => {
      item.classList.toggle('active', item === boton);
    });
    document.querySelectorAll('.app-view').forEach(vistaEl => {
      vistaEl.classList.toggle('hidden', vistaEl.id !== vista);
    });

    window.scrollTo(0, 0);
  });
}

// ==========================================
// 9. INICIALIZACIÓN DE LA APLICACIÓN
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
}

document.addEventListener('DOMContentLoaded', () => {
  cargarDatos();
  configurarEventListeners();
  inicializarNavegacion();
  renderDashboard();
  if (typeof lucide !== 'undefined' && typeof lucide.createIcons === 'function') {
    lucide.createIcons();
  }
  registrarServiceWorker();
});
