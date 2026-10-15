# Protocolo de validación académica

Este documento indica cómo obtener evidencia reproducible del prototipo. La aplicación trabaja con un conjunto vial sintético situado en la zona poniente de Ciudad de México; sus resultados no deben utilizarse para navegación real.

## Prueba automatizada

```bash
npm install
npm test
npm run lint
```

El comando `npm test` compila la aplicación y verifica el algoritmo A*, restricciones físicas, sentidos únicos, alternativas, metadatos, HTML y generación del informe académico.

## Prueba experimental desde la interfaz

1. Abre `http://localhost:3000` y entra como invitado.
2. Baja a **Pruebas y evaluación**.
3. Pulsa **Ejecutar 100 cálculos**.
4. Comprueba que cada escenario muestre **Cumple**. El doble remolque debe ser rechazado en 25/25 corridas porque excede la red disponible; esa salida valida que el motor no inventa una ruta insegura.
5. Descarga `ruta-carga-validacion.csv` y `ruta-carga-validacion.json`.
6. Conserva los dos archivos junto con capturas del mapa, la simulación y un recálculo por bloqueo.

El informe incluye promedio, mediana, percentil 95, máximo, nodos explorados, descartes, distancia, tiempo estimado y secuencia de nodos. También registra la versión y la limitación del conjunto piloto.

## Comprobación visual de la ruta

El selector del mapa ofrece dos representaciones:

- **Calles:** conserva los puntos de paso decididos por A* y ajusta la línea visual a calles mediante OSRM o Google. Este ajuste mejora la presentación, pero no añade restricciones oficiales.
- **Grafo exacto:** dibuja directamente los nodos del conjunto académico. Úsalo para demostrar qué geometría fue evaluada por el motor de restricciones.

En ambas representaciones, la decisión de ruta y los descartes se producen únicamente en el grafo A* documentado.

## Evidencia de usabilidad

Registra por participante, sin datos personales sensibles:

| Campo | Ejemplo |
| --- | --- |
| Identificador anónimo | P01 |
| Perfil | Estudiante / operador / conductor |
| Tarea completada | Sí / No |
| Tiempo de la tarea | segundos |
| Claridad de la ruta | 1 a 5 |
| Comprensión de restricciones | 1 a 5 |
| Observación | texto breve |

El formulario integrado guarda calificación y comentario en el navegador. Para un resultado formal, reúne los registros de la muestra y reporta cantidad de participantes, promedio, dispersión y observaciones recurrentes.

## Criterios de aceptación

- La aplicación compila y todas las pruebas pasan.
- La ruta nunca usa una arista incompatible con las dimensiones o políticas del vehículo.
- Un cierre futuro durante la simulación provoca recálculo o informa que no existe alternativa.
- El informe descargado identifica el conjunto de datos como sintético y no verificado para navegación.
- La memoria final diferencia claramente la geometría visual de las restricciones evaluadas.
