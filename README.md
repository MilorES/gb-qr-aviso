# gb-qr-aviso

Web generalista que envía un aviso MQTT al abrir un código QR. El enlace tiene cuatro partes:

`https://tu-dominio/local/nombre/identificador/tipo_de_aviso`

Ejemplo:

`https://tu-dominio/breston/mesa/01/Cobrar_en_VISA`

- `local`: destinatario de los avisos (por ejemplo, `breston`).
- `nombre`: origen del aviso (por ejemplo, `mesa`, `barra` o `coche`).
- `identificador`: número o nombre que distingue el origen (por ejemplo, `01`).
- `tipo_de_aviso`: detalle del aviso. Los guiones bajos se muestran como espacios.

El ejemplo muestra `MESA 01 Cobrar en VISA` en la página y lo publica en MQTT como `mensaje`.

## Cómo funciona

El navegador valida el enlace y envía sus datos al servidor de esta aplicación. El servidor construye el evento y lo publica en el tema `gb/avisos/<local>`; para el ejemplo, `gb/avisos/breston`. Así se pueden separar los avisos de cada local mediante el tema MQTT.

El servidor conserva las credenciales del broker. No se incluyen en el navegador ni en este repositorio público.

## Desarrollo

Requiere Node.js 20.6 o superior y acceso de red desde el servidor al broker MQTT.

1. Copia `.env.example` como `.env` y completa la configuración del broker.
2. Ejecuta `npm install`.
3. Ejecuta `npm start`.
4. Abre `http://localhost:3000/breston/mesa/01/Cobrar_en_VISA`.

La web debe estar accesible desde los teléfonos y usar HTTPS en producción. El servidor Node debe poder alcanzar el broker por MQTT.

## Configuración

- `MQTT_URL`: URL accesible desde el servidor, por ejemplo `mqtts://broker.example:8883`. La dirección del broker real va en el `.env` local o en la configuración privada del servidor, no en este repositorio.
- `MQTT_USERNAME` y `MQTT_PASSWORD`: credenciales opcionales; solo en `.env` local o en los secretos del servidor.
- `MQTT_TOPIC`: prefijo de tema; por defecto `gb/avisos`. Se añade el valor de `local`.
- `PORT`: puerto HTTP de la web; por defecto `3000`.

El payload es un JSON con `event`, `local`, `nombre`, `identificador`, `tipo_de_aviso`, `mensaje`, `timestamp` e `id`. El mensaje no se conserva (`retain: false`) y usa QoS 1.

### Cifrado y seguridad

El puerto MQTT 1883 no cifra la conexión. Evita enviar credenciales por ese canal desde Internet; para producción, habilita TLS en el broker y conecta con `mqtts://` por un listener seguro. El repositorio es público, así que nunca subas el archivo `.env` ni credenciales reales. Un broker público compartido sirve para pruebas, no para avisos reales.

## Estado

Primera versión en desarrollo. Falta configurar y verificar el acceso desde el servidor real al broker y desplegar la web con HTTPS.
