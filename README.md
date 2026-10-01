# Ruta Carga 3D

Prototipo académico de navegación especializada para transporte pesado. Calcula rutas con A* y descarta los segmentos incompatibles con la altura, el ancho, el peso y la longitud del vehículo. También permite simular cierres, recalcular el recorrido y representar el avance de un agente en un entorno 3D.

## Funciones incluidas

- Selección de origen y destino dentro de una red vial de demostración.
- Perfiles para camión C2, tractocamión T3-S2 y doble remolque.
- Configuración manual de dimensiones y peso.
- Algoritmo A* ponderado por distancia y pendiente.
- Restricciones por gálibo, peso, ancho disponible y pendiente.
- Bloqueos dinámicos con recálculo automático.
- Animación del vehículo en el mapa y simulador WebGL con Three.js.
- Escena tridimensional con carretera dinámica, edificios, iluminación, sombras, puente con gálibo y cuatro cámaras interactivas.
- Bitácora de decisiones, métricas y pruebas automatizadas.
- Diseño adaptable a computadoras, tabletas y teléfonos.

## Ejecución local

Requiere Node.js 22.13 o posterior.

```bash
npm install
npm run dev
```

La aplicación quedará disponible en `http://localhost:3000`.

## Verificación

```bash
npm run build
npm test
```

## Estructura principal

- `app/page.tsx`: interfaz, estados y simulación.
- `app/components/TruckSimulation3D.tsx`: escena Three.js, camión, entorno y cámaras.
- `app/lib/routing.ts`: red vial, restricciones y algoritmo A*.
- `app/globals.css`: diseño completo y vista 3D.
- `tests/`: pruebas de renderizado y presencia del motor de rutas.

## Alcance de los datos

La red vial y sus restricciones son datos sintéticos para una demostración académica en la zona poniente de Ciudad de México. No deben utilizarse para navegación real. Una versión productiva requiere una fuente oficial o verificada de restricciones viales y, si se desea cartografía comercial, las credenciales correspondientes del proveedor de mapas.
