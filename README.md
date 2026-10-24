# DIDI Tracker — Monitor de Ganancias y Rentabilidad

## Descripción

**DIDI Tracker** (o *DIDI Pro*) es una aplicación web progresiva (SPA) orientada a conductores de plataformas de transporte en Colombia (moneda COP). Funciona 100% del lado del cliente (*client-side*), sin requerir servidores ni bases de datos remotas.

Su objetivo principal es permitirle al conductor auditar en tiempo real la rentabilidad real de cada carrera y de su jornada diaria mediante un sistema visual de semáforo (COP/hora y COP/kilómetro), descontar automáticamente el desgaste estimado de combustible para conocer la ganancia neta («bolsillo real»), proyectar el cumplimiento de metas diarias e interpretar sus finanzas a través de métricas y gráficos interactivos.

---

## Funcionalidades

* **Auditoría Inmediata del Último Viaje (Semáforo de Rentabilidad):**
  * Desglose instantáneo de tiempos y distancias (recogida y entrega).
  * Cálculo automático de **COP/hora** y **COP/kilómetro**.
  * Clasificación cromática por umbrales de rentabilidad:
    * 🟢 **Excelente:** Supera metas de hora ($\ge \$30.000/\text{h}$) y distancia ($\ge \$2.000/\text{km}$).
    * 🟡 **Aceptable:** Cumple al menos una meta o se encuentra al $80\%$ de ambas.
    * 🔴 **No Rentable:** No alcanza los umbrales mínimos establecidos.
  * Comparativa porcentual y absoluta frente al promedio de la sesión activa o contra la meta base.

* **Resumen de Jornada y Proyección de Meta Diaria:**
  * Acumulado de ingresos brutos, tiempo activo y promedios globales de la jornada.
  * Control deslizante (*slider*) para ajustar dinámicamente la meta del día (entre $\$30.000$ y $\$400.000$ COP).
  * Barra de progreso porcentual en tiempo real.
  * Proyección del monto faltante y estimación del tiempo restante de conducción según el ritmo promedio alcanzado o la tasa meta.

* **Métricas de Combustible y Bolsillo Real:**
  * Desgaste de gasolina estimado automáticamente por distancia recorrida (por defecto: $\$400\text{ COP/km}$, calculado con base en $\$16.000/\text{gal}$ y $40\text{ km/gal}$).
  * Visualización de la **Ganancia Neta Real** (Ingresos brutos menos costo de gasolina consumida).
  * Registro y bitácora de tanqueadas en estación de servicio (monto en COP, galones reales o autocalculados, odómetro/notas y opción de eliminación).

* **Visualización de Datos con Gráficos Interactivos:**
  * **Gráfico de Dona (Chart.js):** Distribución de ingresos entre Efectivo y Tarjeta/Digital (porcentajes, montos y conteo de carreras).
  * **Gráfico de Barras y Línea (Chart.js):** Rendimiento por carrera en COP/h con color de semáforo por barra, comparado contra una línea de referencia punteada con la meta horaria ($\$30.000/\text{h}$).

* **Gestión de Historial (CRUD Completo):**
  * Tabla con el historial cronológico inverso de todos los viajes registrados.
  * Edición completa de carreras pasadas (tiempos, distancias, precio, método de pago).
  * Eliminación de carreras con recálculo automático de todas las estadísticas.

* **Exportación y Control de Turno:**
  * **Exportar a CSV:** Descarga un reporte completo estructurado con codificación UTF-8 BOM y delimitador punto y coma (`;`), optimizado para abrir directamente en Microsoft Excel en español, incluyendo una fila de resumen global.
  * **Iniciar / Reiniciar Jornada:** Permite reiniciar el contador de inicio y limpiar viajes y tanqueadas previas con confirmación de seguridad.

---

## Tecnologías y APIs Usadas

* **HTML5 Semántico:** Estructura modular dividida en bloques dashboard y ventanas modales de captura accesibles (`dialog`/`overlay`).
* **CSS3 Moderno:**
  * Tema oscuro nativo (*Dark Mode* inspirado en cabinas HUD y paneles fintech).
  * Variables CSS (`:root`) para la paleta oficial de marca (`--brand-orange: #FF6600`, `--bg-cockpit: #0B0F19`, etc.).
  * Maquetación responsiva con CSS Grid y Flexbox (diseño *mobile-first* optimizado para pantallas de smartphone de 390px hasta escritorios ultrawide).
* **JavaScript Vanilla (ES6+):** Lógica pura de aplicación sin frameworks pesados ni dependencias de empaquetado (Node/Webpack no requeridos para producción).
* **Chart.js (v4.4.1 UMD):** Renderizado de gráficos en `<canvas>` con plugins personalizados para texto central en estados vacíos y líneas de referencia de meta.
* **Lucide Icons:** Biblioteca de iconografía vectorial ligera vía CDN.
* **Google Fonts (Inter):** Tipografía de interfaz con alta legibilidad en pantallas móviles y ambientes nocturnos.
* **APIs Web del Navegador:**
  * `localStorage API`: Persistencia offline inmediata de configuración y datos de la sesión activa (`didi_tracker_data`).
  * `Intl.NumberFormat`: Formateo localizado de moneda colombiana (`COP`) y números decimales (`es-CO`).
  * `Blob` y `URL.createObjectURL`: Generación y descarga dinámica del archivo CSV en el cliente.

---

## Estructura de Archivos

| Archivo / Carpeta | Tipo | Descripción |
| :--- | :--- | :--- |
| `index.html` | Markup | Estructura principal de la SPA, modales de ingreso, enlaces CDN y metadatos PWA. |
| `styles.css` | Estilos | Sistema de diseño en dark mode, variables de color, layout responsive y estados de semáforo. |
| `app.js` | Lógica JS | Núcleo de la app: cálculos matemáticos, persistencia, renderizado DOM, eventos y gráficos. |
| `favicon.svg` | Vectorial | Isotipo D-Gauge en SVG con gradiente de marca (`viewBox="0 0 32 32"`). |
| `favicon-32x32.png` | Imagen | Fallback de favicon para pestañas estándar de navegadores web. |
| `favicon-16x16.png` | Imagen | Icono para marcadores y pestañas compactas. |
| `apple-touch-icon.png` | Imagen | Icono para acceso directo en pantalla de inicio de dispositivos iOS/iPadOS (`180x180 px`). |
| `pwa-icon-192.png` | Imagen | Icono PWA para pantalla de inicio en Android (`192x192 px`). |
| `pwa-icon-512.png` | Imagen | Icono de alta resolución para splash screen de Android/PWA (`512x512 px`). |

---

## Cómo Ejecutarlo

Al ser una aplicación web estática del lado del cliente, **no requiere instalación de dependencias, compilación ni base de datos**.

### Opción 1: Apertura Directa en el Navegador
1. Clona o descarga este repositorio en tu equipo.
2. Haz doble clic sobre el archivo `index.html` o ábrelo con cualquier navegador web moderno (Google Chrome, Brave, Safari, Edge, Firefox).

### Opción 2: Servidor Local Ligero (Recomendado)
Para evitar restricciones de políticas de origen cruzado en ciertos navegadores móviles o al probar modo PWA, puedes servir la carpeta con cualquier servidor HTTP local:

* **Con Node.js (npx):**
  ```bash
  npx serve .
  ```
* **Con Python 3:**
  ```bash
  python -m http.server 8080
  ```
* **Con la extensión Live Server de VS Code:**
  Haz clic derecho en `index.html` y selecciona «Open with Live Server».

### Opción 3: Instalación como App en el Teléfono (PWA)
1. Aloja los archivos en cualquier hosting estático gratuito (GitHub Pages, Vercel, Netlify o Cloudflare Pages).
2. Abre la URL en el navegador de tu celular (Chrome en Android o Safari en iPhone).
3. Selecciona en el menú del navegador: «Agregar a la pantalla de inicio» o «Instalar aplicación».

---

## Notas de Arquitectura Relevantes

**Separación de Responsabilidades:**

La lógica de cálculo (`calcularMetricasViaje`, `calcularResumenSesion`) está construida con funciones puras que reciben datos y configuración, retornando nuevos objetos calculados sin mutar el estado global directamente.

La capa de presentación (`renderDashboard`, `renderUltimoViaje`, etc.) se encarga exclusivamente de transferir las métricas calculadas hacia el árbol DOM.

**Modelo de Estado y Persistencia:**

El estado global reside en un único objeto `appData` estructurado en dos ramas principales: `config` (parámetros operativos: metas, rendimiento y costos) y `sesionActual` (fecha de inicio, matriz de viajes y matriz de tanqueadas).

Cada mutación de datos (`guardarViaje`, `eliminarViaje`, `guardarTanqueada`, ajuste del slider) invoca `guardarDatos()`, serializando el estado en `localStorage` bajo la clave `didi_tracker_data`. Si se recarga o cierra el navegador, no se pierde la jornada en curso.

**Ciclo de Vida de los Gráficos:**

Las instancias de Chart.js se almacenan en variables globales (`chartPagosInstance`, `chartCarrerasInstance`).

Al agregar o modificar registros no se destruyen y recrean los canvas, sino que se mutan los arreglos de datos internos y se invoca `.update()`, evitando parpadeos visuales y fugas de memoria.

Cuentan con soporte para renderizar estados vacíos elegantes cuando no hay viajes registrados en la jornada.

**Tolerancia a Fallos y Modo Sin Conexión:**

El renderizado del dashboard verifica la disponibilidad de librerías externas (`typeof Chart !== 'undefined'`, `typeof lucide !== 'undefined'`) para evitar que caídas de red impidan el uso de las funciones esenciales de cálculo y registro.

El isotipo del logo principal (`.brand-logo`) está embebido como SVG inline nativo en lugar de depender de fuentes externas o paquetes de iconos, asegurando carga visual instantánea.
