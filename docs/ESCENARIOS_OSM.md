# Escenarios urbanos OSM

## Vehículos y movimiento

La selección del planificador cambia el modelo de ambas vistas: rígido C2 (2 ejes), tractocamión (5 ejes) o doble remolque (9 ejes). Las dimensiones de la escena de conducción siguen los valores configurados. La clasificación de perfiles personalizados se aproxima por longitud y ejes. La configuración de ejes dibujada reproduce estos tres presets, no todas las combinaciones personalizadas.

`truck-rig.ts` genera cabina, cajas, dolly, ruedas, luces y articulaciones. Los remolques siguen sus enganches con una aproximación cinemática de eje arrastrado: no es un análisis certificado de barrido ni valida radios de giro. Las ruedas giran con la distancia recorrida. En demos hay aceleración progresiva, frenado anticipado ante colas/semáforos y reducción por curvatura. Los autos dejan espacio según la longitud del camión; el tráfico transversal espera mientras el conjunto ocupa el cruce. Las cámaras exteriores se elevan ante edificios cartográficos. La vista principal sigue sincronizada con el motor de avance del planificador.

`npm run models:generate` exporta los tres GLB de `public/models/truck-*.glb` con `scripts/generate-truck-fleet.mjs`. Cesium y Google usan estas variantes estáticas de tamaño estándar, sin articulación dinámica. En la escena de conducción las cajas sí se articulan. Las referencias de próximas curvas se deducen de la geometría; no son instrucciones legales verificadas de giro.

El selector **Mapa geográfico 3D** permite reproducir la misma ruta/progreso en el proveedor configurado con sus terrenos y edificios disponibles. Necesita las credenciales del proveedor; Google también requiere APIs y facturación habilitadas. Los agentes de tráfico se dibujan en la vista de conducción, no sobre el mapa del proveedor. Cambiar de vista conserva el motor de simulación y su avance.

El simulador inferior carga huellas de edificios, calles con nombre, parques, agua, árboles y paradas de autobús de OpenStreetMap. Edificios: altura `height`, luego `building:levels × 3.2`, y 9.6 m cuando no hay datos. Las fachadas son recreadas; no son fotografías.

La escena arranca con su entorno procedural y lo sustituye cuando llegan edificios cartográficos. Las calles adyacentes son contexto visual; los agentes siguen la ruta principal. El terreno sigue plano, el ancho de la ruta principal y sus carriles se recrean; los cruces y sus semáforos son académicos, no posiciones ni fases verificadas. No se representa todavía la separación vertical de puentes y túneles. Solo se leen vías y nodos; no se reconstruyen edificios multipolígono de relaciones ni huecos/patios.

Se consultan entre dos y ocho zonas de aproximadamente 560 m alrededor de puntos repartidos por la ruta. En rutas largas la cobertura es parcial y puede haber espacios sin edificios. El pie de la escena indica cuántos elementos se dibujaron y si se utiliza el entorno de respaldo.

- `app/api/scenery/route.ts`: coordenadas validadas, consulta Overpass con tiempo límite; si falla, pequeños extractos de la API OSM con dos solicitudes simultáneas como máximo. Caché de servidor de 24 horas y deduplicación de solicitudes.
- `app/lib/osm-scenery.ts`: proyección métrica idéntica a la ruta, alturas, selección de zonas y caché local de siete días, limitada a ocho recorridos.
- `app/lib/osm-scene.ts`: extrusión de polígonos, fachadas, calles, áreas naturales y etiquetas.
- `app/lib/simulation-world.ts`: integración asíncrona y liberación de recursos al cambiar de ruta.

Las geometrías viales descargadas también se recuerdan siete días (hasta 24 recorridos) y se reintentan una vez ante fallo de red. No se inventa una línea recta cuando no hay geometría.

Datos © OpenStreetMap contributors, ODbL: https://www.openstreetmap.org/copyright. Servicios públicos con disponibilidad variable; este prototipo no es un servicio de navegación certificado. Las tarifas de casetas y las keys de Google/Cesium no intervienen en esta capa.
