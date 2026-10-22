# Estado del proyecto frente al documento

Este archivo compara **Ruta Carga 3D** con `PT (18).pdf`. El alcance aceptado es un **prototipo académico**: tráfico, GPS, semáforos, agentes, bloqueos, autenticación y datos viales se simulan o guardan localmente. No debe usarse como navegador para transporte real.

## Resultado de la ampliación

Los elementos que antes estaban marcados como parciales o pendientes ya cuentan con una implementación demostrable dentro del alcance académico.

| Área del documento | Estado del prototipo | Evidencia en la aplicación |
| --- | --- | --- |
| Configuración física del camión | ✅ Implementada | Altura, ancho, longitud, peso, ejes, radio de giro, consumo, carga y perfiles locales. |
| Grafo y algoritmo A* | ✅ Implementados | Red dirigida, heurística, medición en milisegundos, nodos explorados y hasta tres alternativas. |
| Restricciones viales | ✅ Implementadas | Gálibo, peso total y por eje, ancho, pendiente, radio de giro, HazMat, zonas privadas, peajes, baches, obras y cierres. |
| Costos y preferencias | ✅ Implementados | Ruta balanceada, rápida, económica o segura; combustible, peajes, costo operativo, tiempo y riesgo. |
| Origen, destino y GPS | ✅ Implementados | Nueve puntos identificables con dirección, coordenadas WGS84, fuente y nivel de precisión; coordenadas personalizadas y GPS simulado. |
| Mapa y ruta 3D | ✅ Implementados | Cesium/OSM gratuito, Google opcional, modo calles y modo grafo exacto; la interfaz distingue ajuste visual de validación A*. |
| Agente camión | ✅ Implementado | Posición, orientación, aceleración, frenado, estados internos y cuatro cámaras. |
| Tráfico y semáforos | ✅ Implementados | Densidad determinista, ciclo semafórico y velocidad/reacción del agente. |
| Múltiples agentes | ✅ Implementados | Cinco vehículos de tráfico más el camión principal en la escena 3D. |
| Bloqueos autónomos | ✅ Implementados | Evento durante la marcha, cierre de tramo, recálculo y bitácora. |
| Memoria de experiencia | ✅ Implementada | Penalizaciones aprendidas localmente influyen en cálculos posteriores. |
| Acceso y persistencia | ✅ Implementados | Perfil local o invitado; vehículos, recorridos, cámara y evaluación en `localStorage`. |
| Validación académica | ✅ Implementada | Cuatro escenarios, lote de 100 cálculos, promedio/mediana/p95/máximo, CSV/JSON y formulario local de usabilidad. |

La escena base y el modelo del camión se generaron con apoyo de IA y se integraron como recursos reproducibles del prototipo.

## 1. Vehículo

| Requisito | Implementación académica |
| --- | --- |
| Dimensiones y peso | Campos editables y perfiles C2, T3-S2 y doble remolque. |
| Ejes y peso por eje | Número de ejes y validación del peso medio por eje contra cada tramo. |
| Maniobrabilidad | Radio de giro del vehículo comparado con la capacidad del segmento. |
| Tipo de carga | General, refrigerada y peligrosa, con filtrado HazMat. |
| Consumo | Litros por 100 km para estimar combustible y costo. |
| Guardar vehículos | Perfiles nombrados almacenados en el navegador. |

## 2. Red, restricciones y eventos

La red sintética conecta nueve referencias geográficas comprobables de una zona piloto de CDMX. Sus aristas pueden ser dirigidas y contener velocidad, gálibo, ancho, peso total, peso por eje, pendiente, radio de giro, peaje, condición vial, semáforo, autorización privada y permiso HazMat.

El conjunto declara la referencia WGS84, cobertura, versión, fecha de comprobación y procedencia en `PILOT_DATASET_METADATA`. Cada nodo muestra dirección y fuente en la interfaz. Las distancias y los tiempos base usan una instantánea dirigida de OSRM del 14 de octubre de 2026; las restricciones operativas y los incidentes siguen siendo sintéticos. Las referencias viales se distinguen de los marcadores de los lugares para evitar entradas innecesarias a estacionamientos. Consulta `docs/RUTAS_VIALES.md`. Los sentidos únicos del grafo se mantienen y las métricas de ida y vuelta pueden diferir.

Los eventos tienen tipo, ubicación, gravedad, vigencia y capacidad de bloquear un tramo. Pueden crearse manualmente o aparecer durante la simulación. El tráfico, los semáforos, baches, obras, accidentes y manifestaciones son datos de demostración, no fuentes en tiempo real.

## 3. Cálculo de rutas

El motor usa A* con heurística geográfica y descarta segmentos incompatibles antes de compararlos. La preferencia inicial es «Más corta · menos rodeos»; también ofrece equilibrio, tiempo, costo o riesgo. El ranking conserva la misma función objetivo y filtra alternativas excesivamente largas. Para cada ruta calcula:

- distancia y tiempo estimado;
- riesgo y restricciones aplicadas;
- nodos explorados y tiempo real del algoritmo;
- combustible, peajes y costo operativo;
- semáforos y advertencias del recorrido.

El operador debe seleccionar y confirmar una alternativa antes de iniciar la simulación.

## 4. Mapa y simulación 3D

- **Cesium/OSM:** proveedor predeterminado y gratuito para el prototipo.
- **Google Maps 3D:** integración opcional; requiere una clave propia con APIs y facturación habilitadas.
- **Three.js:** geometría vial completa, ciudad recreada, carriles, árboles, cruces, pasos peatonales, semáforos y tráfico longitudinal y transversal. La ruta principal y tres demos cortos están disponibles en el selector inferior.
- **Cámaras:** seguimiento, cabina, frontal, lateral, órbita, cenital, ruta completa y tour. También se pueden inspeccionar de tres a ocho sectores sin mover al camión.
- **Movimiento:** coordenadas métricas, colas con separación, frenado ante rojo, pausa, reinicio y búsqueda de posición. Los demos tienen reproducción ×1/×2/×4. La ruta principal usa sus minutos estimados como tiempo base y puede esperar por vehículos próximos.

Los detalles, controles y límites están documentados en `docs/SIMULACION_RECORRIDO_3D.md`. El entorno, los carriles, los cruces y el tráfico son recreados; no son una captura de las condiciones reales de las calles.

## 5. Comportamiento del agente

El agente expone estados como planeando, en ruta, esperando semáforo, recalculando y finalizado. Durante el recorrido puede detectar un evento simulado, detenerse, descartar el tramo, ejecutar A* desde su posición y continuar por la alternativa. La penalización del evento se guarda como memoria local y modifica cálculos posteriores.

Es aprendizaje por experiencia **demostrativo y basado en penalizaciones**, no un modelo de aprendizaje automático.

## 6. Acceso y datos locales

El flujo inicial permite crear un perfil local o entrar como invitado. No hay servidor de identidad ni contraseña. Se almacenan únicamente en el navegador:

- sesión académica;
- perfiles de vehículos;
- historial de rutas;
- cámara preferida;
- memoria de penalizaciones;
- evaluaciones de usuario;
- claves de mapas introducidas desde el cuadro `Claves`.

Al borrar los datos del navegador se elimina esta información. `.env.local` no debe subirse a GitHub.

## 7. Validación

El panel **Pruebas y evaluación** ejecuta 25 repeticiones de cuatro escenarios: C2 estándar, T3-S2 con cierre, carga peligrosa y doble remolque. Resume viabilidad, promedio, mediana, percentil 95, máximo, nodos explorados y restricciones. Los resultados pueden descargarse en CSV y JSON con versión y procedencia del conjunto. También permite registrar una calificación de claridad y observaciones locales. El protocolo está en `docs/VALIDACION_ACADEMICA.md`.

Las pruebas automatizadas verifican el motor de rutas, métricas operativas, restricciones físicas, sentidos únicos, alternativas, metadatos del conjunto piloto, HTML renderizado y presencia de las funciones académicas. La revisión de TypeScript, React y accesibilidad también queda limpia. Ejecuta todo con:

```bash
npm test
npm run lint
```

## Límites declarados

Todo lo solicitado por el documento tiene una representación funcional para exposición académica. Permanecen fuera de alcance productivo:

- tráfico, GPS, telemetría e incidentes reales;
- inventario oficial y actualizado de puentes, pesos, permisos y geometría vial;
- autenticación segura, servidor, base de datos y recuperación de cuenta;
- navegación certificada, guía por voz y operación sin conexión;
- auditoría, monitoreo, disponibilidad y cumplimiento legal;
- validación en campo con transportistas y autoridades.

## Conclusión

El prototipo permite configurar y guardar un camión, calcular y comparar rutas compatibles, confirmar una alternativa, visualizarla en 3D y simular un agente que interactúa con tráfico, semáforos, otros vehículos y bloqueos. También registra métricas y evaluación académica. Las limitaciones reales están declaradas para evitar confundir la demostración con un sistema de navegación productivo.
