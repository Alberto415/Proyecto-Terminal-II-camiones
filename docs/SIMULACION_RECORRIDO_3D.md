# Simulación del recorrido completo — v2.3.0

La escena inferior usa la geometría vial completa que consulta OSRM, incluyendo sus giros y puntos intermedios. Ya no dibuja una curva simple entre las posiciones del grafo esquemático. Las coordenadas se convierten a metros para que las calles, el camión y los vehículos guarden una escala consistente.

## Recorridos disponibles

El selector «Recorrido» permite usar:

1. La ruta activa del planificador, conservando su progreso, pausa y validación académica. Debe confirmarse antes de reproducirla.
2. Demo 1: UAM Cuajimalpa → Parque La Mexicana.
3. Demo 2: UAM Cuajimalpa → Centro Santa Fe.
4. Demo 3: Terminal Poniente → Metro Observatorio.

Los tres demos son escenarios visuales independientes. No cambian el vehículo, las restricciones o la selección de la ruta principal, ni acreditan que un tractocamión pueda circular por sus calles. Su marcha base es de aproximadamente 30 km/h antes de frenadas; «Tiempo» permite verlos a ×1, ×2 o ×4. La ruta principal usa como base los minutos estimados del planificador en tiempo real, más las pausas del agente, en lugar de comprimir recorridos largos en uno o dos minutos. El frenado en los cruces se calcula con una distancia de aproximadamente 12 metros y no con un porcentaje fijo del recorrido.

## Cámaras y sectores

- Seguimiento detrás del camión, cabina, frontal, lateral, cenital y órbita libre.
- «Ruta completa» encuadra todo el recorrido.
- «Tour de sectores» visita automáticamente distintas partes cada seis segundos.
- Cada recorrido se divide en tres a ocho sectores, según su longitud. Los botones de sectores cambian el punto de inspección de la cámara, sin teletransportar al camión.
- El minimapa conserva el recorrido completo y la posición del camión.
- La barra «Explorar recorrido» permite buscar una posición y deja el recorrido en pausa. En la ruta activa sincroniza el avance del planificador; en los demos solo afecta a la escena de demostración.
- «Ampliar» lleva los controles y la escena a pantalla completa.

## Entorno y tráfico

La ciudad es una recreación procedural sobre el trazado vial: calzadas, carriles, veredas, edificios, zonas arboladas, cruces, pasos peatonales, señales y marcadores de salida y destino. Los edificios y los cruces son escenografía y no un levantamiento real de CDMX.

Los agentes circulan por carriles de sentidos opuestos. El tráfico longitudinal aplica aceleración, frenada y separación respecto al vehículo precedente y al camión. Dos cruces con semáforos se ubican al 33% y 68% del recorrido para corresponder con las fases académicas. El tráfico transversal aparece durante el rojo del camión. La densidad puede ser fluida, moderada o intensa en los demos; la ruta activa recibe el nivel de tráfico del planificador.

El camión de demostración se detiene ante los semáforos y las colas. En la ruta principal, la escena puede indicar al planificador que espere por un vehículo cercano. La pausa congela el desplazamiento del tráfico y del camión; las cámaras siguen disponibles para inspección.

## Archivos

| Archivo | Responsabilidad |
| --- | --- |
| `app/components/TruckSimulation3D.tsx` | Selector de recorridos, controles, cámaras, minimapa, reproducción y conexión con el planificador. |
| `app/lib/simulation-route.ts` | Modelo métrico de la ruta, muestreo por distancia, sectores, tráfico y frenado del demo. |
| `app/lib/simulation-world.ts` | Escena Three.js, ciudad, carreteras, semáforos, vehículos, cámaras y renderizado. |
| `app/lib/simulation-assets.ts` | Modelos geométricos del camión y automóviles. |
| `tests/simulation-route.test.mjs` | Pruebas del recorrido completo, giros, separación, semáforos, densidad y frenado. |

Se usan edificios, árboles y marcas viales instanciados para reducir llamadas de dibujo. El renderizado se suspende fuera del área visible; al cambiar de recorrido se liberan los recursos del mundo anterior.

## Requisitos y límites

Requiere WebGL y conexión a OSRM para obtener el trazado. No necesita una API key adicional para esta escena. Si la consulta falla se muestra un error con «Reintentar»; no se sustituye silenciosamente por una línea recta.

El tráfico es una simulación de seguimiento de carril y colas. No es una simulación física de dinámica vehicular ni un sistema de tráfico real. Los carriles bidireccionales de la recreación son académicos; su distribución no prueba el sentido legal de cada calle. El tráfico, los edificios, los semáforos y los cruces no representan observaciones en tiempo real.

## Comprobaciones de entrega

Se verificó el modelo con los trazados obtenidos para los tres demos: aproximadamente 1.634 m / 83 vértices, 2.254 m / 57 vértices y 386 m / 27 vértices. Con tráfico moderado y fases de semáforo, los tres llegaron al final en la prueba numérica del motor. Esto comprueba avance y ausencia de bloqueo permanente en esos escenarios, pero no sustituye la inspección gráfica.

La compilación y las pruebas automatizadas cubren la integración y el modelo. La comprobación visual automatizada quedó limitada por una falla de conexión de la herramienta de navegador. El proyecto aún tiene tres errores de tipado anteriores relacionados con Cloudflare (`cloudflare:workers`, `Fetcher`, `D1Database`); no hay errores de TypeScript señalados en los nuevos módulos del simulador.
