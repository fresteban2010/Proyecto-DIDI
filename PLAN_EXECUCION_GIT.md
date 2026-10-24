# Plan de Ejecución: Organizar Proyecto para Git/GitHub (DIDI Tracker)

> **Estado:** ✅ ESTRUCTURA Y MANIFEST EJECUTADOS — FALTA SOLO LA INICIALIZACIÓN DE GIT.

## 1. Estructura de Carpetas (YA APLICADA ✅)

```
Proyecto DIDI/
├── .gitignore
├── README.md
├── index.html
├── css/
│   └── styles.css
├── js/
│   └── app.js
└── assets/
    └── icons/
        ├── favicon.svg
        ├── favicon-16x16.png
        ├── favicon-32x32.png
        ├── apple-touch-icon.png
        ├── pwa-icon-192.png
        ├── pwa-icon-512.png
        └── manifest.json   ← NUEVO (PWA instalable)
```

### Cambios de rutas aplicados en `index.html` ✅
| Antes (raíz) | Después |
| :--- | :--- |
| `<link rel="stylesheet" href="styles.css">` | `<link rel="stylesheet" href="css/styles.css">` |
| `<script src="app.js"></script>` | `<script src="js/app.js"></script>` |
| `<link rel="icon" href="favicon.svg">` | `<link rel="icon" href="assets/icons/favicon.svg">` |
| `<link rel="apple-touch-icon" href="apple-touch-icon.png">` | `<link rel="apple-touch-icon" href="assets/icons/apple-touch-icon.png">` |
| *(no existía)* | `<link rel="manifest" href="assets/icons/manifest.json">` |

### manifest.json (PWA instalable) ✅
- **name:** "DIDI Pro - Monitor de Ganancias y Rentabilidad"
- **short_name:** "DIDI Pro"
- **display:** `standalone` (sin barra del navegador, a pantalla completa)
- **theme_color:** `#FF6600` (naranja marca)
- **background_color:** `#0B0F19` (negro oscuro cockpit)
- **orientation:** `portrait`
- **icons:** pwa-icon-192.png + pwa-icon-512.png
- **lang:** es-CO

> ✅ Verificado: JSON válido, sin errores de consola al cargar la página.

## 2. Archivo `.gitignore` (YA CREADO ✅)
```gitignore
# Sistema operativo
.DS_Store
Thumbs.db
desktop.ini

# Editores / entornos
.vscode/
.idea/
*.sublime-project
*.sublime-workspace

# Exportaciones de datos del usuario (privacidad: ganancias reales)
*.csv
didi_jornada_*.csv

# Logs y temporales
*.log
npm-debug.log*
yarn-debug.log*

# Dependencias / build (por si crece el proyecto)
node_modules/
dist/
.cache/
```

## 3. Pasos de Terminal para Inicializar Git y Subir a GitHub

### A. Inicializar Git
```bash
git init -b main
git status
git add .
git commit -m "feat: inicializar proyecto DIDI Tracker con estructura organizada y PWA"
```

### B. Subir a GitHub
**Opción A (recomendada, más rápida):**
```bash
gh repo create didi-tracker --public --source=. --remote=origin --push
```
*(Requiere `gh` autenticado: `gh auth login`. Si no lo está, usamos la Opción B.)*

**Opción B (manual):**
1. Crear repo vacío en `github.com/new` → nombre `didi-tracker`, sin README/.gitignore/licencia.
2. ```bash
   git remote add origin https://github.com/TU-USUARIO/didi-tracker.git
   git push -u origin main
   ```

## 4. Flujo de Trabajo Futuro (buenas prácticas)

### Ramas (Feature Branch Workflow)
- `main` = siempre estable/deployable.
- Para cada cambio: `git checkout -b feature/<nombre>` → editar → commit → `git checkout main` → `git merge feature/<nombre>` → `git push origin main` → `git branch -d feature/<nombre>`.

### Convención de commits (Conventional Commits)
| Prefijo | Uso | Ejemplo |
| :--- | :--- | :--- |
| `feat:` | Nueva funcionalidad | `feat(charts): tooltip detallado en gráfico de pagos` |
| `fix:` | Corrección de bug | `fix(layout): posición del botón CTA en desktop` |
| `style:` | CSS/formato sin lógica | `style(brand): resplandor del isotipo` |
| `refactor:` | Reorganización sin cambiar comportamiento | `refactor(math): separar semáforo en función pura` |
| `docs:` | Documentación | `docs: actualizar README` |
| `chore:` | Mantenimiento/config | `chore: ignorar reportes csv en .gitignore` |

## 5. Despliegue Gratis (Opcional, posterior)
GitHub → Settings → Pages → Branch: `main`, carpeta `/` → URL: `https://TU-USUARIO.github.io/didi-tracker/`

---

## ✅ Checklist de Aprobación (PENDIENTE)
Antes de que yo ejecute la inicialización de Git y el push a GitHub, confirma:
- [ ] ¿Aceptas la estructura final con manifest.json?
- [ ] ¿Tienes `gh` (GitHub CLI) autenticado? Si no, usamos la Opción B.
- [ ] ¿Repo **público** o **privado**?
- [ ] ¿Cuál es tu usuario de GitHub (para la Opción B)?
