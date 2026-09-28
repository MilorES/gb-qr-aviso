# gb-qr-aviso

Web generalista de avisos al abrir códigos QR. Cada enlace lleva el establecimiento y la mesa, por ejemplo:

`https://tu-dominio/breston/mesa/12`

Al abrirse, la web valida la ruta y solicita al servidor que publique un evento MQTT. El servidor conserva las credenciales del broker; no se incluyen en el navegador ni en este repositorio público.

## Desarrollo

Requiere Node.js 20 o superior y acceso de red desde el servidor al broker MQTT.

1. Copia `.env.example` como `.env` y completa la configuración del broker.
2. Ejecuta `npm install`.
3. Ejecuta `npm start`.
4. Abre `http://localhost:3000/breston/mesa/12`.

La instancia que atiende las visitas de los QR debe estar accesible desde los teléfonos y usar HTTPS en producción. El servidor Node debe poder alcanzar el broker por MQTT.

## Configuración

- `MQTT_URL`: URL MQTT accesible desde el servidor, por ejemplo `mqtts://broker.example:8883`.
- `MQTT_USERNAME` y `MQTT_PASSWORD`: credenciales opcionales.
- `MQTT_TOPIC`: tema de avisos; por defecto `gb/avisos/qr`.
- `PORT`: puerto HTTP de la web; por defecto `3000`.

El evento JSON publicado contiene `event`, `bar`, `mesa`, `timestamp` e `id`. El mensaje no se conserva (`retain: false`) y usa QoS 1.

## Estado

Primera base del proyecto. Falta adaptar la conexión al broker real y desplegar en un servidor accesible desde las mesas.
