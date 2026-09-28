# gb-qr-aviso

Web generalista de avisos al abrir códigos QR. Cada enlace lleva el establecimiento y la mesa, por ejemplo:

`https://tu-dominio/breston/mesa/12`

Al abrirse, la web valida la ruta y pide al servidor que publique un evento MQTT. Las credenciales del broker se guardan en variables de entorno del servidor; nunca se incluyen en el navegador ni en este repositorio público.

## Desarrollo

Requiere Node.js 20.6 o superior y acceso de red desde el servidor al broker MQTT.

1. Copia `.env.example` como `.env` y completa la configuración del broker.
2. Ejecuta `npm install`.
3. Ejecuta `npm start`.
4. Abre `http://localhost:3000/breston/mesa/12`.

La instancia que atiende las visitas de los QR debe estar accesible desde los teléfonos y usar HTTPS en producción. El servidor Node debe poder alcanzar el broker por MQTT.

## Configuración

- `MQTT_URL`: URL MQTT accesible desde el servidor, por ejemplo `mqtts://broker.example:8883`. Para el broker actual, anota la dirección privada de conexión en tu `.env`, no en este repositorio.
- `MQTT_USERNAME` y `MQTT_PASSWORD`: credenciales opcionales, solo en `.env` local o en los secretos del servidor.
- `MQTT_TOPIC`: tema de avisos; por defecto `gb/avisos/qr`.
- `PORT`: puerto HTTP de la web; por defecto `3000`.

El evento JSON publicado contiene `event`, `bar`, `mesa`, `timestamp` e `id`. El mensaje no se conserva (`retain: false`) y usa QoS 1.

### Cifrado y seguridad

El puerto MQTT 1883 no cifra la conexión. Evita usar credenciales en ese canal desde Internet; para producción, habilita TLS en el broker y conecta con `mqtts://` por un listener seguro. El repositorio es público, así que nunca subas el archivo `.env` ni credenciales reales. Un broker público compartido sirve para pruebas, no para avisos reales.

## Estado

Primera versión en desarrollo. Falta configurar y verificar el acceso desde el servidor real al broker y desplegar la web con HTTPS.
