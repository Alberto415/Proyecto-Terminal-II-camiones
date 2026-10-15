# Trazado vial y reducción de rodeos (v2.2.4)

Revisión del 14 de octubre de 2026.

## Problema corregido

Se enviaban los centros de campus, centros comerciales y parques como paradas obligatorias al proveedor vial. Por ejemplo, el punto de Centro Santa Fe terminaba dentro del estacionamiento y la UAM se enlazaba con una calle posterior. Además, A* comparaba longitudes sintéticas y el ranking posterior podía promover una alternativa usando una función de costo distinta.

## Comportamiento actual

- `app/lib/road-network.ts` conserva nueve referencias sobre calles consultadas mediante OSRM nearest/route. Son puntos de circulación, no entradas de carga certificadas. Los marcadores de los lugares conservan las coordenadas de `routing.ts`.
- El mismo archivo incluye matrices dirigidas de distancias y tiempos devueltas por OSRM Table. Cada sentido se calcula por separado. Son una instantánea de la red vial, no datos de tráfico ni un perfil pesado certificado.
- A* usa esa distancia vial, una heurística geográfica admisible y las restricciones académicas existentes. La opción inicial «Más corta · menos rodeos» minimiza la distancia entre las rutas admitidas por el grafo. Las otras preferencias conservan su función ponderada de costos.
- Las alternativas se ordenan con la misma función de costo de A*. Se descartan los rodeos de más del 60% salvo que aporten una mejora significativa en tiempo o, en el modo de menor riesgo, en seguridad académica.
- Cesium consulta las referencias viales con continuidad de marcha y alternativas. Se elige una geometría compacta, penalizando retornos y sin aceptar una duración excesiva. No se borran giros de una polilínea para fabricar atajos.
- Google recibe esas mismas referencias; los puntos intermedios se indican con `via: true`, manteniendo el orden del grafo. Si no hay geometría de Google se intenta OSRM y se muestra la procedencia correcta. Google puede producir un recorrido distinto por sus datos y condiciones.
- Las respuestas OSM se reutilizan en memoria. Si el proveedor falla, el modo calles informa un error; no presenta líneas rectas entre edificios como si fueran calles.
- El camión de Cesium avanza según la distancia de la geometría, en lugar de saltar por cantidades iguales de vértices.

## Comparación reproducida

Para `UAM → Centro Santa Fe → La Mexicana`, usando los mismos lugares y el mismo orden, la consulta previa de OSRM devolvió **7.092,5 metros**. La nueva consulta sobre referencias viales devolvió aproximadamente **3.892 metros**, una reducción cercana al **45%**. El trazado interpolado suma aproximadamente 3.896 km por diferencias numéricas entre la geometría y la métrica del proveedor.

Para un vehículo académico compatible con el enlace `e02`, UAM → La Mexicana usa directamente ese enlace: aproximadamente **1,6 km**. Con el perfil T3-S2 se conserva el recorrido de aproximadamente **3,9 km**, porque `e02` lo rechaza por sus límites de demostración. No se levantaron restricciones para acortar el dibujo.

Observatorio → Terminal Poniente mide aproximadamente **2,3 km** y el regreso **0,4 km** en esta instantánea. La asimetría procede de la red vial consultada; una distancia corta en línea recta no implica que ambos sentidos permitan el mismo recorrido.

## Límites

El grafo continúa siendo una red académica de 16 enlaces entre nueve referencias. «Más corta» significa la menor distancia entre las rutas compatibles de ese grafo, no un óptimo global sobre toda la red de CDMX. Las geometrías de OSRM/Google son para conducción general; no validan los gálibos, puentes, pesos, radios de giro ni cierres sintéticos del prototipo. Los tiempos son estimaciones del proveedor ajustadas por el tráfico simulado. Los cambios de calles y las condiciones de Google pueden modificar el resultado.

Fuentes: [OSRM Route y Table](https://project-osrm.org/docs/v5.24.0/api/), [puntos de paso de Google](https://developers.google.com/maps/documentation/javascript/routes/pass-through), © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright).

## Verificación

`npm test` incluye pruebas de enlace corto, bloqueo, restricciones físicas, sentidos viales, óptimo de A* contrastado con todos los caminos simples para varios casos, orden de alternativas, referencias viales, selección de geometría compacta, interpolación por distancia y fallo del proveedor.
