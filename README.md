# Ruta Carga 3D

## Documentación adicional

- [`README_ESTADO_PROYECTO.md`](README_ESTADO_PROYECTO.md): comparación entre los requisitos del Proyecto Terminal y el código actual, con funciones implementadas, parciales y pendientes.



## Qué incluye

- Perfiles para camión C2, tractocamión T3-S2 y doble remolque.
- Configuración de altura, ancho, longitud y peso.
- Configuración de ejes, peso por eje, radio de giro y consumo de combustible.
- A* ponderado con rutas balanceadas, rápidas, económicas o de menor riesgo.
- Restricciones por gálibo, peso, ancho, pendiente, maniobrabilidad, sentido único, zonas privadas, materiales peligrosos, peajes, semáforos, condición vial e incidentes.
- Hasta tres alternativas, comparación y confirmación obligatoria antes de iniciar.
- Bloqueos dinámicos, recálculo autónomo y memoria local de penalizaciones.
- Ruta ajustada a calles con OSRM.
- Selector entre ajuste visual a calles y geometría exacta del grafo validado.
- Vista 3D con Cesium, terreno, imagen satelital y edificios OSM.
- Integración opcional con Google Photorealistic 3D y Routes API.
- Modelo GLB de tractocamión con aceleración, crucero, frenado y cámara de seguimiento.
- Orientación longitudinal corregida para que la cabina apunte hacia el sentido de avance.
- Simulador WebGL adicional construido con Three.js.
- Tráfico, GPS, semáforos y cinco agentes secundarios simulados.
- Perfil local o invitado e historial persistente en el navegador.
- Panel académico con cuatro escenarios, 100 cálculos, estadísticas y exportación CSV/JSON.
- Pruebas automatizadas del motor, HTML y funciones del prototipo.
- Conjunto piloto documentado con coordenadas WGS84, fuentes visuales y advertencia de restricciones sintéticas.
- Nueve ubicaciones identificables con dirección, coordenadas, procedencia y enlace de comprobación.
- Sentidos únicos validados mediante pruebas funcionales del algoritmo.

## Árbol de carpetas

```text
MapaCamiones3D/
├── app/                   Aplicación React, interfaz, mapas y motor de rutas
│   ├── components/        Componentes visuales y simuladores 3D
│   ├── lib/               Algoritmo A* y datos de la red vial
│   └── _sites-preview/    Carpeta reservada para la vista previa de Sites
├── public/                Archivos estáticos servidos directamente
│   └── models/            Modelos tridimensionales GLB
├── scripts/               Herramientas auxiliares
├── docs/                  Protocolo y criterios de validación académica
├── tests/                 Pruebas automatizadas
├── worker/                Punto de entrada para Cloudflare Workers
├── build/                 Empaquetado para OpenAI Sites
├── db/                    Preparación opcional de base de datos D1
├── drizzle/               Metadatos/migraciones de Drizzle
├── examples/              Ejemplos opcionales, no activos
├── .openai/               Configuración de publicación en Sites
├── .claude/               Preferencias locales de otra herramienta
├── .idea/                 Preferencias del IDE JetBrains
├── .git/                  Historial y metadatos de Git
├── .next/                 Tipos generados compatibles con Next.js
├── .vinext/               Caché y recursos de Vinext
├── .wrangler/             Estado local de Cloudflare Wrangler
├── dist/                  Resultado compilado
└── node_modules/          Dependencias instaladas por npm
```

## Carpetas con código de la aplicación

### `app/`

Es la carpeta principal. Aquí está la interfaz que ve el usuario, el cálculo de rutas y los componentes 3D.

| Archivo o carpeta | Función |
| --- | --- |
| `app/page.tsx` | Pantalla principal. Administra formularios, perfiles del camión, origen, destino, bloqueos, simulación, métricas y selección del visor. |
| `app/layout.tsx` | Estructura raíz del documento, metadatos y carga de estilos globales. |
| `app/globals.css` | Colores, paneles, formularios, mapa, indicadores, adaptación móvil y estados visuales. |
| `app/chatgpt-auth.ts` | Funciones auxiliares para autenticación en infraestructura compatible con ChatGPT. La ejecución local no depende de iniciar sesión. |
| `app/lib/routing.ts` | Núcleo lógico: nodos, segmentos, restricciones, función de costo, A*, evaluación de riesgo y utilidades de ruta. |
| `app/lib/academic-simulation.ts` | Tráfico, semáforos, GPS, eventos, agentes y nombres del almacenamiento local del prototipo. |
| `app/lib/academic-evaluation.ts` | Escenarios, estadísticas y exportación reproducible del informe de validación. |
| `app/components/AcademicSessionGate.tsx` | Acceso académico con perfil local o modo invitado, sin autenticación remota. |
| `app/components/AcademicEvaluationPanel.tsx` | Escenarios de validación, ejecución de 100 cálculos y evaluación local de usuario. |
| `app/components/CesiumRoadMap3D.tsx` | Mapa 3D predeterminado: Cesium, edificios OSM, terreno, ruta, camión, giros y cámara. |
| `app/components/GooglePhotorealistic3D.tsx` | Integración opcional con Google Maps Photorealistic 3D y Routes API. |
| `app/components/TruckSimulation3D.tsx` | Escena independiente de Three.js con carretera, edificios, puente, luces, sombras, cámaras y camión. |
| `app/_sites-preview/` | Carpeta reservada por el entorno de vista previa. Actualmente no contiene lógica del proyecto. |

### `public/`

Recursos estáticos servidos desde la raíz de la aplicación.

| Archivo o carpeta | Función |
| --- | --- |
| `public/models/cargo-truck.glb` | Modelo 3D del tractocamión que representa al agente durante el traslado. |
| `public/favicon.svg` | Icono de la pestaña. |
| `public/og.png` | Imagen de presentación para vistas previas o redes sociales. |
| `public/file.svg`, `globe.svg`, `window.svg` | Recursos heredados de la plantilla; no son esenciales para el simulador actual. |

### `scripts/`

Herramientas que se ejecutan manualmente, no código cargado en cada visita.

- `scripts/generate-truck-model.mjs`: reconstruye de forma reproducible `public/models/cargo-truck.glb`.

### `tests/`

- `tests/routing.test.mjs`: ejecuta rutas reales del grafo para comprobar métricas, restricciones físicas, sentidos únicos, alternativas y metadatos piloto.
- `tests/rendered-html.test.mjs`: compila y comprueba que el HTML incluya el contenido esperado.
- `tests/academic-prototype.test.mjs`: comprueba que las funciones académicas acordadas estén integradas.
- `tests/academic-evaluation.test.mjs`: comprueba el informe, sus estadísticas y la exportación CSV.

## Carpetas de despliegue y funciones opcionales

### `worker/`

`worker/index.ts` es el punto de entrada para ejecutar la aplicación como Cloudflare Worker. Atiende las solicitudes de Vinext e incluye optimización de imágenes. No necesitas modificarlo para cambiar el mapa o el algoritmo.

### `build/`

`build/sites-vite-plugin.ts` copia la configuración de Sites y las migraciones a `dist/.openai` al terminar la compilación. Es infraestructura de empaquetado.

### `db/`

Preparación para una base de datos Cloudflare D1 mediante Drizzle ORM.

- `db/index.ts`: crea la conexión a D1 si existe el enlace `DB`.
- `db/schema.ts`: lugar para declarar tablas. Está vacío porque el simulador funciona sin base de datos.

### `drizzle/`

Guarda el historial y las migraciones de Drizzle. `drizzle/meta/_journal.json` registra su estado. Solo es importante si agregas tablas y ejecutas `npm run db:generate`.

### `examples/`

Ejemplo opcional de una API de notas usando D1:

- `examples/d1/db/schema.ts`: esquema de ejemplo.
- `examples/d1/app/api/notes/route.ts`: endpoints `GET` y `POST` de ejemplo.

Esta carpeta **no forma parte de la aplicación activa**. Sirve como referencia para guardar rutas, vehículos o viajes en una futura base de datos.

### `.openai/`

`.openai/hosting.json` guarda el identificador y los enlaces opcionales de recursos para publicar con OpenAI Sites. No contiene el algoritmo ni las claves de Google/Cesium.

## Carpetas generadas automáticamente

No deben editarse manualmente:

| Carpeta | Qué contiene | Cómo se vuelve a crear |
| --- | --- | --- |
| `node_modules/` | Librerías descargadas por npm. Es grande y no se incluye en el ZIP del código. | `npm install` |
| `dist/` | Aplicación compilada: cliente, servidor, recursos y metadatos. | `npm run build` |
| `.vinext/` | Caché, bloqueo del servidor y fuentes de Vinext. | `npm run dev` o `npm run build` |
| `.next/` | Tipos generados compatibles con el enrutador de Next.js. | `npm run dev` o `npm run build` |
| `.wrangler/` | Estado local y caché de Cloudflare Wrangler/Miniflare. | Se crea al ejecutar el entorno local. |

`tsconfig.tsbuildinfo` también es un archivo generado: guarda la caché incremental de TypeScript.

## Carpetas de herramientas locales

| Carpeta | Función |
| --- | --- |
| `.git/` | Historial, ramas y configuración local del repositorio. |
| `.idea/` | Ajustes para IntelliJ IDEA/WebStorm; no afectan la compilación. |
| `.claude/` | Preferencias locales de una herramienta de asistencia; no afectan la aplicación. |

## Archivos de la raíz

| Archivo | Función |
| --- | --- |
| `.env.local` | Claves reales de Google y Cesium. Es secreto, está ignorado por Git y **no debe compartirse**. |
| `.env.example` | Plantilla segura con los nombres de variables, sin credenciales reales. |
| `.gitignore` | Indica a Git qué claves, cachés, dependencias y compilaciones ignorar. |
| `package.json` | Nombre, librerías y comandos `dev`, `build`, `test`, `lint` y `db:generate`. |
| `package-lock.json` | Fija versiones exactas para reproducir la instalación. |
| `vite.config.ts` | Configura Vite, Vinext, Cloudflare y el empaquetado para Sites. |
| `next.config.ts` | Configuración compatible con Next/Vinext; usa valores predeterminados. |
| `tsconfig.json` | Reglas de TypeScript, JSX, módulos y alias `@/`. |
| `next-env.d.ts` | Declaraciones de tipos para Next/Vinext. |
| `eslint.config.mjs` | Reglas de calidad, React, TypeScript y accesibilidad. |
| `postcss.config.mjs` | Procesamiento de CSS mediante PostCSS/Tailwind. |
| `drizzle.config.ts` | Configura el esquema y la salida de migraciones. |
| `README.md` | Este documento. |

## Dónde cambiar cada función

| Si quieres cambiar... | Modifica principalmente... |
| --- | --- |
| Orígenes, destinos o segmentos viales | `app/lib/routing.ts` |
| Restricciones de altura, peso, ancho o pendiente | `app/lib/routing.ts` |
| Costo, heurística o comportamiento de A* | `app/lib/routing.ts` |
| Formularios, paneles, métricas o controles | `app/page.tsx` |
| Colores, tamaños y diseño adaptable | `app/globals.css` |
| Mapa Cesium, edificios, cámara o ruta | `app/components/CesiumRoadMap3D.tsx` |
| Vista de Google Maps 3D | `app/components/GooglePhotorealistic3D.tsx` |
| Escena Three.js y cámaras | `app/components/TruckSimulation3D.tsx` |
| Velocidad y suavizado del traslado | `app/page.tsx` y los componentes del mapa 3D |
| Apariencia del camión | `public/models/cargo-truck.glb` o `scripts/generate-truck-model.mjs` |
| Pruebas del algoritmo | `tests/routing.test.mjs` |
| Tráfico, GPS, semáforos y eventos simulados | `app/lib/academic-simulation.ts` y `app/page.tsx` |
| Acceso local y evaluación académica | `app/components/AcademicSessionGate.tsx` y `app/components/AcademicEvaluationPanel.tsx` |
| Claves de mapas | `.env.local` |

## Instalación y ejecución

Requiere Node.js 22.13 o posterior.

```bash
npm install
npm run dev
```

Abre `http://localhost:3000`.

Al entrar puedes crear un perfil local o continuar como invitado. Para demostrar el flujo completo:

1. Configura o carga un vehículo.
2. Selecciona origen, destino y preferencia.
3. Pulsa `Calcular ruta segura`, compara las alternativas y confirma una.
4. Inicia el recorrido y observa tráfico, semáforos, agentes y recálculo.
5. Revisa `Entorno`, `Diagnóstico` y el panel `Pruebas y evaluación`.
6. Descarga CSV/JSON y sigue [`docs/VALIDACION_ACADEMICA.md`](docs/VALIDACION_ACADEMICA.md) para reunir evidencia de entrega.

## Variables de mapas

Copia `.env.example` como `.env.local` y coloca tus propias credenciales:

```dotenv
NEXT_PUBLIC_CESIUM_ION_TOKEN=tu_token_de_cesium
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=tu_clave_de_google
NEXT_PUBLIC_GOOGLE_MAPS_3D=false
```

Con `NEXT_PUBLIC_GOOGLE_MAPS_3D=false`, la aplicación usa Cesium. Para activar Google, cambia el valor a `true`, habilita **Maps JavaScript API** y **Routes API**, y activa la facturación en Google Cloud.

Las variables `NEXT_PUBLIC_` llegan al navegador. Restringe las credenciales por dominio y por API desde las consolas de sus proveedores. Si modificas `.env.local`, reinicia el servidor.

### Configuración desde la interfaz

La barra superior del mapa incluye el botón `🔑 Claves`. Desde ese cuadro puedes:

- Elegir Cesium o Google 3D como proveedor preferido.
- Agregar o reemplazar el token de Cesium ion.
- Agregar o reemplazar la API key de Google Maps.
- Mostrar temporalmente los valores mientras los editas.
- Borrar las credenciales recordadas.

Los valores introducidos allí se guardan en `localStorage`, únicamente en ese navegador y dispositivo. No se escriben en `.env.local`, no forman parte del código fuente y no se suben a GitHub. El almacenamiento del navegador no convierte una clave pública de mapas en un secreto: aplica restricciones de dominio y de API en Google Cloud y Cesium ion.

## Comandos disponibles

| Comando | Resultado |
| --- | --- |
| `npm run dev` | Inicia el servidor de desarrollo. |
| `npm run build` | Compila la aplicación en `dist/`. |
| `npm run start` | Inicia la versión compilada. |
| `npm test` | Compila y ejecuta las pruebas automatizadas. |
| `npm run lint` | Revisa código, React, TypeScript y accesibilidad. |
| `npm run verify:locations` | Contrasta las nueve ubicaciones con sus objetos OSM y el código Plus de Tacubaya; requiere Internet. |
| `npm run db:generate` | Genera migraciones tras cambiar `db/schema.ts`. |

## Cómo compartir el proyecto

Incluye las carpetas de código y los archivos de configuración, pero excluye:

- `.env.local`, porque contiene credenciales.
- `node_modules/`, porque se reconstruye con `npm install`.
- `dist/`, `.next/`, `.vinext/` y `.wrangler/`, porque son resultados o cachés.
- `.git/`, si no necesitas compartir el historial.

La persona que reciba el código debe crear su propio `.env.local`, ejecutar `npm install` y después `npm run dev`.

## Alcance y limitaciones

El catálogo completo fue contrastado el 14 de octubre de 2026. Consulta [Coordenadas verificadas](docs/COORDENADAS_VERIFICADAS.md) para ver coordenadas, objetos cartográficos y fuentes de cada lugar. Los marcadores conservan la posición del lugar aunque la ruta se ajuste a una calle cercana. Cada ficha permite abrir ese mismo punto en Google Maps e indica si representa un edificio, un parque, una calle o la celda de un código Plus.

La opción inicial «Más corta · menos rodeos» usa distancias viales dirigidas consultadas en OSRM, referencias de circulación fuera de estacionamientos y un ranking consistente con A*. Consulta [Trazado vial y reducción de rodeos](docs/RUTAS_VIALES.md) para ver las correcciones, ejemplos y límites del cálculo.

La demostración usa puntos geográficos identificables de la zona poniente de Ciudad de México. Cada selección muestra dirección, seis decimales y fuente. Tráfico, GPS, semáforos, agentes, bloqueos, autenticación e historial se simulan o almacenan localmente. Las distancias y los tiempos base proceden de una instantánea OSRM de conducción general; los límites de puentes, pesos, pendientes, permisos y zonas HazMat continúan siendo sintéticos. El grafo académico limita las rutas disponibles y los proveedores viales no certifican circulación de vehículos pesados. Una versión productiva necesita datos oficiales, autenticación y persistencia seguras, telemetría y un proveedor certificado para vehículos pesados.
