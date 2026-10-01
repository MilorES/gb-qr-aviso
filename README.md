# GB QR Avisos · servidor

Servidor web para las solicitudes que llegan desde códigos QR. Comprueba el código rotatorio del local y publica el aviso en MQTT.

## Experiencia web

La página está disponible en catalán de forma predeterminada, y también en castellano, francés e inglés. El visitante puede cambiar el idioma; la elección se recuerda en ese navegador.

Al escanear un QR aparece el local y el punto de servicio, por ejemplo `Breston Figueres · Mesa 01`. La persona introduce el código visible en el local y elige una de estas dos acciones:

- Llamar al camarero.
- Pedir la cuenta.

Los botones incluyen iconos y se pueden usar desde una pantalla móvil. El cuarto segmento opcional de la URL puede resaltar una acción conocida, pero no envía el aviso sin que la persona pulse un botón.

Al pulsar una acción con un código de seis cifras válido, el campo del código se limpia inmediatamente. Para volver a intentarlo, hay que introducirlo de nuevo.

Formato de la URL:

`https://tu-dominio/local/nombre/identificador/tipo_de_aviso`

Ejemplos:

- `https://tu-dominio/Breston_Figueres/Mesa/01`
- `https://tu-dominio/Breston_Figueres/Mesa/01/Pedir_Cuenta`

Los segmentos del tema MQTT respetan mayúsculas y minúsculas. `Breston_Figueres`, `Mesa` y `01` se conservan exactamente como aparecen en el QR. Los guiones bajos del nombre del local solo se sustituyen por espacios al mostrarlo en pantalla.

## Mensajes MQTT

Cada acción tiene un texto MQTT estable, independiente del idioma elegido en la web. Por defecto, el botón de llamar al camarero publica `Pedir` y el de pedir la cuenta publica `Tiquet`. Estos valores se pueden cambiar en `.env` mediante `CALL_WAITER_ALERT_TYPE` y `REQUEST_BILL_ALERT_TYPE`.

Para el QR `/Breston_Figueres/Mesa/01`, el topic MQTT es:

`Breston_Figueres/Mesa/01`

La URL del QR empieza por `/`, como es habitual en una ruta web; el topic MQTT no lleva esa barra inicial.

El payload es solo el texto configurado para la acción elegida. No incluye el local ni la mesa. El idioma seleccionado (`ca`, `es`, `fr` o `en`) y la IP del visitante se envían aparte como propiedades de usuario MQTT 5 (`language` y `client_ip`); no cambian ni el tema ni el payload. El tema distingue mayúsculas y minúsculas.

La conexión con el broker la realiza el servidor; el navegador nunca recibe las credenciales MQTT.

## Código rotatorio del local

- `VALID_LOCALS`: locales permitidos, con los nombres exactos separados por comas, por ejemplo `Breston_Figueres,Orange_Cafe`.
- `LEGACY_TOPIC_LOCALS`: locales retirados cuyos antiguos retained `/<Local>/codigo` se deben borrar al iniciar, separados por comas.
- `LOCAL_CODE_SECRET`: secreto privado de al menos 32 bytes, usado para crear los códigos.
- `LOCAL_CODE_PERIOD_SECONDS`: duración de cada código; por defecto, 30 segundos.
- `ALERT_TYPES`: tipos válidos adicionales, separados por comas. Los paréntesis están permitidos y los guiones bajos se muestran como espacios.
- `CALL_WAITER_ALERT_TYPE`: payload fijo del botón para llamar al camarero; por defecto `Pedir`.
- `REQUEST_BILL_ALERT_TYPE`: payload fijo del botón para pedir la cuenta; por defecto `Tiquet`.

El servidor publica el código actual de cada local en `<Local>/codigo`, como texto con QoS 1 y retain. Publica un código nuevo al cambiar cada periodo y acepta el periodo actual y el anterior. Al iniciar, elimina los antiguos retained `/<Local>/codigo` para que no quede el topic anterior con barra inicial. Si retiraste un local de `VALID_LOCALS`, inclúyelo temporalmente en `LEGACY_TOPIC_LOCALS` para borrar su retained antiguo.

Después de diez códigos erróneos desde una misma IP y para el mismo local en un minuto, se bloquean nuevos intentos durante esa ventana. También se limita el volumen general de solicitudes.

## Puesta en marcha local con Docker

Requisitos: Docker Engine y Docker Compose.

1. Copia `.env.example` como `.env`.
2. Configura el broker, los locales, las credenciales y `LOCAL_CODE_SECRET` en `.env`. Mantén ese archivo fuera de Git.
3. Desde la carpeta del repositorio, ejecuta `docker compose up -d --build`.
4. Comprueba los registros con `docker compose logs -f`.
5. Para detener el servicio, ejecuta `docker compose down`.

La página queda disponible en `http://localhost:3000`. Compose enlaza el puerto a `127.0.0.1:3000`; para publicarla en Internet, usa un proxy HTTPS que dirija las rutas de QR al contenedor. El móvil debe acceder por HTTPS.

## Configuración MQTT

- `MQTT_URL`: dirección accesible desde el contenedor, por ejemplo `mqtt://broker-host:1883`.
- `MQTT_USERNAME` y `MQTT_PASSWORD`: credenciales opcionales del broker.
- `PORT`: puerto web interno; por defecto, `3000`.
- `TRUSTED_PROXY_IPS`: IP o IPs separadas por comas de proxies inversos de confianza. Solo desde esas conexiones se interpreta `X-Forwarded-For`; si queda vacío, se informa la IP de conexión que ve directamente el servidor web.

El broker debe admitir MQTT 5 y permitir al servidor publicar en `<Local>/codigo` y `<Local>/<Nombre>/<Identificador>`. También debe permitir publicar un payload vacío y retained en `/<Local>/codigo`, usado únicamente para borrar el retained antiguo al arrancar. Una pantalla que muestre códigos solo necesita lectura de `<Local>/codigo`. Los clientes que quieran leer `language` y `client_ip` también deben conectarse usando MQTT 5 y acceder a las propiedades de usuario del mensaje.

`mqtt://` en el puerto 1883 no cifra el tráfico. Para una conexión por Internet con credenciales, configura TLS en el broker y usa `mqtts://`.

## Estado

El servidor se ha ejecutado localmente en Docker y se comprobó en los registros que conectaba con MQTT. Esta actualización añade la interfaz en cuatro idiomas, las dos acciones rápidas y las propiedades MQTT 5 `language` y `client_ip`; falta reconstruir el contenedor y comprobarlo con el broker y los clientes.

El cliente de Windows se desarrolla en el repositorio separado `gb-qr-aviso-clients`. La aplicación Android queda para una fase posterior.
