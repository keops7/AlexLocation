# MotoNav — posición en vivo

Worker de Cloudflare `motonav-vivo` (cuenta `alexcruzkeops`). Recibe la posición de la placa y la enseña en una página con mapa.

- La placa llama a `http://motonav-vivo.alexcruzkeops.workers.dev/p?k=…`. Lo hace cada minuto en marcha y cada 5 minutos parada, siempre que tenga internet por el hotspot del móvil. Se puede apagar en Opciones → Posición en vivo.
- El enlace para compartir es `https://motonav-vivo.alexcruzkeops.workers.dev/?v=…`. Sale en la web de la placa (192.168.4.1), en la tarjeta "Posición en vivo".
- Guarda los puntos de las últimas 12 h en KV (clave `estado`). La capa gratuita de KV da 1000 escrituras al día, unas 16 h de moto.
- Sin la clave correcta responde 404.

Las claves están en `../src/vivo.h` (`VIVO_KEY` sirve para enviar y `VIVO_VER` para ver). Si cambias alguna, cámbiala también en los secretos del Worker y vuelve a flashear la placa.

## Despliegue

El código está en el repo de GitHub `keops7/AlexLocation`. El Worker `motonav-vivo` de Cloudflare está conectado a ese repo y se publica solo con cada push a `main` (comando de despliegue `npx wrangler deploy`). El KV `motonav-vivo-pos` ya tiene su id puesto en `wrangler.toml`. Los secretos `WRITE_KEY` y `VIEW_KEY` se ponen en el panel: Worker → Configuración → Variables y secretos.

## Probar en local (sin cuenta)

`.dev.vars` lleva claves de prueba (`prueba-escritura` / `prueba-ver`).
```
npx wrangler dev --local --port 8787
curl "http://localhost:8787/p?k=prueba-escritura&la=36.84&lo=-2.46&v=60&r=30&q=80"
```
Luego abre http://localhost:8787/?v=prueba-ver. Hay una captura de cómo se ve en `muestra_vivo.jpg`.
