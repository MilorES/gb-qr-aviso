# gb-qr-aviso

Web generalista que envía un aviso MQTT al abrir un código QR. El formato de la URL es:

`https://tu-dominio/local/nombre/identificador/tipo_de_aviso`

El último segmento es opcional. Ejemplos:

- `https://tu-dominio/breston/mesa/01/Cobrar_en_VISA`
- `https://tu-dominio/breston/mesa/01`

Significado de los segmentos:

- `local`: quién recibe el aviso, por ejemplo `breston`.
- `nombre`: origen del aviso, por ejemplo `mesa`, `barra` o `coche`.
- `identificador`: distingue el origen, por ejemplo `01`, `B` o `ABC`.
- `tipo_de_aviso`: texto del aviso. Los guiones bajos se convierten en espacios; si se omite, el texto es `Predeterminado`.

## Mensaje MQTT

Se publica texto plano (no JSON):

- Tema: `/local/nombre/identificador`
- Payload: `tipo_de_aviso` con guiones bajos convertidos en espacios; si falta, `Predeterminado`.

Para el ejemplo se publica:

- Tema: `/breston/mesa/01`
- Payload: `Cobrar en VISA`

El payload predeterminado para `/breston/mesa/01` sería `Predeterminado`. La web muestra el aviso completo como `MESA 01 Cobrar en VISA`.\n\nLos segmentos `local` y `nombre` se conservan tal como aparecen en la URL. MQTT distingue mayúsculas y minúsculas en los temas: `/Breston/Mesa/01` y `/breston/mesa/01` son temas diferentes.

El navegador interpreta los tres segmentos obligatorios y el cuarto opcional, y los envía al servidor. El servidor valida los datos y publica el texto plano en el tema indicado. Las credenciales MQTT se guardan en el archivo `.env`, que se monta como solo lectura dentro del contenedor y queda excluido de Git.

## Puesta en marcha con Docker

Requisitos: Docker Engine y Docker Compose.

1. Copia `.env.example` como `.env`.
2. Edita `.env` con la dirección del broker y sus credenciales.
3. En la carpeta del proyecto ejecuta `docker compose up -d --build`.
4. Consulta el estado con `docker compose logs -f`.
5. Para detenerlo, ejecuta `docker compose down`.

La web queda disponible localmente en el puerto 3000. Compose la enlaza a `127.0.0.1` para que un proxy HTTPS del mismo servidor pueda publicarla con el dominio. El proxy debe dirigir rutas como `/breston/mesa/01/Cobrar_en_VISA` al contenedor y mantener HTTPS para los móviles.

## Configuración del broker

- `MQTT_URL`: URL accesible desde el contenedor, como `mqtt://broker-host:1883`.
- `MQTT_USERNAME` y `MQTT_PASSWORD`: credenciales opcionales del broker.
- `PORT`: puerto interno de la web; por defecto `3000`.

El proceso Node debe poder alcanzar el broker desde la red donde se ejecuta Docker. La dirección privada o pública real del broker va en el `.env` del servidor, nunca en el repositorio público.

### Cifrado

El puerto 1883 con `mqtt://` no cifra la conexión. Si se usan credenciales por Internet, podrían viajar sin cifrar. Para producción, habilita TLS en el broker y configura una dirección `mqtts://` segura. Un broker público compartido sirve para pruebas, no para avisos reales.

## Estado actual

**Preparado en el repositorio:** lectura de rutas QR con tipo opcional, composición del texto del aviso, publicación MQTT en texto plano, configuración Docker Compose y exclusión de `.env` de Git.

**Pendiente:** rellenar `.env` en el servidor, comprobar la conexión real al broker, arrancar y verificar el contenedor, y publicar el dominio mediante un proxy HTTPS.
