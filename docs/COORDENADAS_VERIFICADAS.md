# Catálogo de ubicaciones

Revisión: 14 de octubre de 2026. Sistema de coordenadas: WGS84 (latitud, longitud).

Se consultaron directamente objetos identificados de OpenStreetMap mediante Nominatim. Los puntos de áreas y edificios son sus puntos representativos devueltos por el geocodificador; no son entradas de carga certificadas. Las direcciones se contrastaron con páginas institucionales cuando están disponibles. Tacubaya conserva el código Plus elegido por el usuario.

| Lugar | Latitud | Longitud | Objeto cartográfico |
| --- | --- | --- | --- |
| UAM Cuajimalpa | 19.3519954 | -99.2826512 | [W370898699](https://www.openstreetmap.org/way/370898699) |
| Centro Santa Fe | 19.3612975 | -99.2737949 | [W30291947](https://www.openstreetmap.org/way/30291947) |
| Parque La Mexicana | 19.3568024 | -99.2716771 | [W607127540](https://www.openstreetmap.org/way/607127540) |
| Patio Santa Fe | 19.3772092 | -99.2545267 | [W444007401](https://www.openstreetmap.org/way/444007401) |
| Calle Bosque de Manzanos | 19.3952891 | -99.2466165 | [W656792738](https://www.openstreetmap.org/way/656792738) |
| Tacubaya | 19.4014375 | -99.1878125 | [76F2CR26+HV](https://plus.codes/76F2CR26+HV) |
| Fuente de Petróleos | 19.4274474 | -99.2031066 | [W98280658](https://www.openstreetmap.org/way/98280658) |
| Metro Observatorio | 19.3982702 | -99.2004166 | [W217419203](https://www.openstreetmap.org/way/217419203) |
| Terminal Central de Autobuses del Poniente | 19.3962001 | -99.1997725 | [W30178858](https://www.openstreetmap.org/way/30178858) |

## Criterios y correcciones

- Se mantuvieron las coordenadas que coincidían con los objetos consultados: UAM, Centro Santa Fe, Patio Santa Fe, Fuente de Petróleos y Terminal Poniente.
- La Mexicana ahora usa el punto representativo del parque completo. La coordenada anterior no tenía un objeto cartográfico asociado en el código.
- Bosque de Manzanos ahora identifica explícitamente la calle, con su objeto vial y coordenadas. No se sustituye por el parque homónimo ni por el centro de Bosques de las Lomas.
- Metro Observatorio conserva su estación del STC, actualizando la precisión a la respuesta del objeto. No se confunde con la estación del tren El Insurgente.
- Tacubaya conserva el centro de la celda del código Plus corto `CR26+HV`, resuelto como `76F2CR26+HV`.
- Las coordenadas de reserva de cámara, GPS sin ruta y el ejemplo del campo de coordenadas se toman del catálogo UAM; ya no se mantienen puntos independientes sin nombre.
- Los marcadores de Google y Cesium se colocan en las coordenadas del catálogo, incluyendo los puntos intermedios. La geometría de circulación puede ajustarse a una calle cercana sin mover esos marcadores.

## Fuentes institucionales complementarias

- [UAM Cuajimalpa: ubicación y dirección](https://www.cua.uam.mx/uam-cuajimalpa/ubicacion).
- [Centro Santa Fe: información general](https://centrosantafe.com.mx/pages/informacion-general) y [accesos y servicios](https://centrosantafe.com.mx/pages/servicios-al-cliente).
- [Parque La Mexicana: sitio del parque](https://parquelamexicana.mx/).
- [Patio Santa Fe: Secretaría de Turismo de CDMX](https://www.mexicocity.cdmx.gob.mx/venues/patio-santa-fe/).
- [Fuente de Petróleos: Secretaría de Turismo de CDMX](https://mexicocity.cdmx.gob.mx/venues/fuente-de-petroleos/).
- [Terminal Poniente: sitio de la terminal](https://centralponiente.com.mx/) y [dirección de taquilla Autovías](https://www.autovias.com.mx/terminales/taquillas.html).

## Repetir la verificación

Ejecuta `npm run verify:locations` con Node.js 22.13 o posterior y conexión a Internet. Realiza una única consulta a Nominatim por los ocho identificadores OSM y compara sus posiciones con el catálogo; también decodifica el código Plus de Tacubaya. Una diferencia superior a 25 metros devuelve error para solicitar revisión. Los objetos cartográficos pueden cambiar con futuras ediciones. Este comando no modifica las coordenadas automáticamente.

El mapa no necesita consultar Nominatim al abrirse. Los datos se conservan en `app/lib/routing.ts`, con identificador y fuente por lugar. Datos OSM: © OpenStreetMap contributors, [ODbL](https://www.openstreetmap.org/copyright).

La ubicación de un inmueble no acredita el acceso de un camión. Los parques, monumentos y estaciones usan puntos del lugar y el proveedor vial ajusta la circulación a la calle. Los puentes, permisos, pesos y demás restricciones del grafo siguen siendo datos académicos sintéticos.
