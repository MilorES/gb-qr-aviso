# gb-qr-aviso

Web generalista que permite seleccionar y enviar un aviso MQTT al abrir un código QR. El formato de la URL es:

`https://tu-dominio/local/nombre/identificador/tipo_de_aviso`

El último segmento es opcional. Sin él, la web presenta la lista de avisos del local. Si se incluye, deja ese aviso preseleccionado. En ambos casos se exige el código vigente del local. Ejemplos:

- `https://tu-dominio/Breston/Mesa/01/Pedir_Cuenta`
- `https://tu-dominio/Breston/Mesa/01`

Significado de los segmentos:

- `local`: quién recibe el aviso, por ejemplo `Breston` o `Breston_Figueres`. Puede contener letras, números, guiones y guiones bajos.
- `nombre`: origen del aviso, por ejemplo `mesa`, `barra` o `coche`.
- `identificador`: distingue el origen, por ejemplo `01`, `B` o `ABC`.
- `tipo_de_aviso`: aviso preseleccionado. Los guiones bajos se convierten en espacios. Si no aparece, se elige en la web.

## Mensaje MQTT

Se publica texto plano (no JSON):

- Tema: `/local/nombre/identificador`
- Payload: solo el aviso elegido, con guiones bajos convertidos en espacios.

Para el ejemplo se publica:

- Tema: `/Breston/Mesa/01`
- Payload: `Pedir Cuenta`

La web muestra el contexto `Mesa 01`; ese texto no se incluye en el payload MQTT. Los segmentos `local` y `nombre` se conservan tal como aparecen en la URL. MQTT distingue mayúsculas y minúsculas en los temas: `/Breston/Mesa/01` y `/breston/mesa/01` son temas diferentes.

El navegador interpreta los tres segmentos obligatorios y el cuarto opcional, muestra el formulario y envía el código local y el aviso elegido al servidor. El servidor valida ambos y publica únicamente el texto del aviso en el tema indicado. Las credenciales y el secreto para generar códigos se guardan en `.env`, montado como solo lectura dentro del contenedor y excluido de Git.

## Verificación del local por código MQTT

- `VALID_LOCALS` contiene los nombres exactos permitidos, separados por comas, por ejemplo `Breston,OtroLocal`. Se conservan mayúsculas y minúsculas porque los temas MQTT distinguen el caso.
- `ALERT_TYPES` contiene las opciones comunes a los locales, separadas por comas. Admite paréntesis; los guiones bajos se muestran como espacios, por ejemplo `Pedir_Cuenta` se muestra como `Pedir Cuenta`.
- `LOCAL_CODE_SECRET` es un secreto aleatorio que debe mantenerse privado.
- `LOCAL_CODE_PERIOD_SECONDS` controla la rotación; el valor inicial es 30 segundos.

El servidor genera un código numérico de seis cifras distinto por local y publica el actual, como texto plano con QoS 1 y retain, en `/<Local>/codigo` (por ejemplo `/Breston/codigo`). Una pantalla del local puede suscribirse a ese tema y mostrar el payload. El servidor acepta el periodo actual y el anterior. Tras diez códigos erróneos por IP y local durante un minuto, bloquea nuevos intentos hasta que pase esa ventana.

El consumidor de pantalla necesita permiso MQTT de lectura únicamente para los temas de código que debe mostrar. El usuario del servidor necesita permiso de publicación para `/<Local>/codigo` y `/<Local>/+/+` (o los topics de avisos que se definan). No expongas estos temas ni las credenciales a suscriptores no autorizados. Para uso por Internet configura TLS en el broker.

## Puesta en marcha con Docker

Requisitos: Docker Engine y Docker Compose.

1. Copia `.env.example` como `.env`.
2. Edita `.env` con la dirección del broker, credenciales, locales y avisos permitidos. Sustituye `LOCAL_CODE_SECRET` por un valor aleatorio privado.
3. En la carpeta del proyecto ejecuta `docker compose up -d --build`.
4. Consulta el estado con `docker compose logs -f`.
5. Para detenerlo, ejecuta `docker compose down`.

La web queda disponible localmente en el puerto 3000. Compose la enlaza a `127.0.0.1` para que un proxy HTTPS del mismo servidor pueda publicarla con el dominio. El proxy debe dirigir rutas como `/Breston/Mesa/01/Pedir_Cuenta` al contenedor y mantener HTTPS para los móviles.

## Configuración del broker

- `MQTT_URL`: URL accesible desde el contenedor, como `mqtt://broker-host:1883`.
- `MQTT_USERNAME` y `MQTT_PASSWORD`: credenciales opcionales del broker.
- `PORT`: puerto interno de la web; por defecto `3000`.

El proceso Node debe poder alcanzar el broker desde la red donde se ejecuta Docker. La dirección privada o pública real del broker va en el `.env` del servidor, nunca en el repositorio público.

### Cifrado

El puerto 1883 con `mqtt://` no cifra la conexión. Si se usan credenciales por Internet, podrían viajar sin cifrar. Para producción, habilita TLS en el broker y configura una dirección `mqtts://` segura. Un broker público compartido sirve para pruebas, no para avisos reales.

## Estado actual

**Preparado en el repositorio:** formulario de avisos, validación de códigos locales rotatorios, publicación MQTT del código y del aviso, configuración Docker Compose y exclusión de `.env` de Git. La integración con la pantalla física y la comprobación en el broker quedan pendientes.

**Pendiente:** rellenar `.env` en el servidor, comprobar la conexión real al broker, arrancar y verificar el contenedor, y publicar el dominio mediante un proxy HTTPS.

