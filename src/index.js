// MotoNav - posicion en vivo.
//  GET /p?k=WRITE_KEY&la=&lo=&v=&r=&q=&t=   la placa manda su posicion (cada 1-5 min)
//  GET /VIEW_KEY  (o /?v=VIEW_KEY)           pagina con el mapa (es el enlace que se comparte)
//  GET /d?v=VIEW_KEY                         datos para la pagina (JSON)
// Guarda en KV (clave "estado") los puntos de las ultimas 12 h. Sin las claves: 404.

const HORAS = 12;
const MAX_PUNTOS = 800;

export default {
  async fetch(req, env) {
    const u = new URL(req.url);
    const q = u.searchParams;

    if (u.pathname === '/p') {
      if (!env.WRITE_KEY || q.get('k') !== env.WRITE_KEY) return new Response('no', { status: 404 });
      const ahora = Math.floor(Date.now() / 1000);
      const p = {
        s: ahora,                         // hora del servidor (la que se usa para "hace X min")
        la: Number(q.get('la')),
        lo: Number(q.get('lo')),
        v: Number(q.get('v')) || 0,       // km/h
        r: Number(q.get('r')) || 0,       // rumbo
        q: Number(q.get('q')),            // km que quedan de ruta (-1 = sin ruta)
      };
      if (!Number.isFinite(p.la) || !Number.isFinite(p.lo) || Math.abs(p.la) > 90 || Math.abs(p.lo) > 180)
        return new Response('mal', { status: 400 });
      const d = (await env.POS.get('estado', 'json')) || { pts: [] };
      d.pts = d.pts.filter((x) => ahora - x.s < HORAS * 3600);
      d.pts.push(p);
      if (d.pts.length > MAX_PUNTOS) d.pts = d.pts.slice(-MAX_PUNTOS);
      await env.POS.put('estado', JSON.stringify(d));
      return new Response('ok');
    }

    // Enlace corto: /CLAVE (igual que /?v=CLAVE)
    if (env.VIEW_KEY && u.pathname === '/' + env.VIEW_KEY)
      return new Response(PAGINA, {
        headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex' },
      });
    if (!env.VIEW_KEY || q.get('v') !== env.VIEW_KEY) return new Response('No encontrado', { status: 404 });
    if (u.pathname === '/d') {
      const d = (await env.POS.get('estado', 'json')) || { pts: [] };
      return Response.json({ ahora: Math.floor(Date.now() / 1000), pts: d.pts }, { headers: { 'cache-control': 'no-store' } });
    }
    if (u.pathname === '/') {
      return new Response(PAGINA, {
        headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex' },
      });
    }
    return new Response('No encontrado', { status: 404 });
  },
};

const PAGINA = `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>MotoNav en vivo</title>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<style>
html,body{margin:0;height:100%;font-family:-apple-system,system-ui,sans-serif}
#mapa{position:absolute;inset:0}
#info{position:absolute;left:10px;right:10px;bottom:16px;z-index:1000;background:#111d;color:#fff;border-radius:12px;
padding:12px 14px;max-width:420px;margin:auto;box-shadow:0 2px 10px #0006}
#info b{font-size:1.15rem}#info small{color:#bbb}
.viejo b{color:#f5a623}
</style></head><body>
<div id="mapa"></div>
<div id="info"><b>Cargando...</b></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
const v=new URLSearchParams(location.search).get('v')||location.pathname.slice(1);
const mapa=L.map('mapa',{zoomControl:false}).setView([40.2,-3.7],6);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18,
 attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'}).addTo(mapa);
const rastro=L.polyline([],{color:'#d6249f',weight:5,opacity:.8}).addTo(mapa);
const yo=L.circleMarker([0,0],{radius:9,color:'#fff',weight:3,fillColor:'#d6249f',fillOpacity:1});
let centrado=false;
function hace(s){const m=Math.round(s/60);if(m<1)return'ahora mismo';if(m<60)return'hace '+m+' min';
 return'hace '+Math.floor(m/60)+' h '+String(m%60).padStart(2,'0')+' min'}
async function cargar(){
 try{
  const d=await (await fetch('/d?v='+encodeURIComponent(v),{cache:'no-store'})).json();
  const info=document.getElementById('info');
  if(!d.pts.length){info.innerHTML='<b>Sin datos todavia</b><br><small>MotoNav aun no ha mandado su posicion (necesita el punto de acceso del movil encendido).</small>';return}
  const ll=d.pts.map(p=>[p.la,p.lo]);rastro.setLatLngs(ll);
  const u=d.pts[d.pts.length-1];yo.setLatLng([u.la,u.lo]).addTo(mapa);
  if(!centrado){mapa.fitBounds(rastro.getBounds().pad(.2),{maxZoom:14});centrado=true}
  const edad=d.ahora-u.s,viejo=edad>15*60;
  info.className=viejo?'viejo':'';
  info.innerHTML='<b>'+(viejo?'Sin señal '+hace(edad):(u.v>4?u.v+' km/h':'Parado')+' · '+hace(edad))+'</b><br><small>'+
   (u.q>=0?'Quedan '+u.q.toFixed(0)+' km de ruta · ':'')+
   (viejo?'Sin cobertura o MotoNav apagado. ':'')+'Se actualiza solo.</small>';
 }catch(e){document.getElementById('info').innerHTML='<b>Sin conexión</b>'}
}
cargar();setInterval(cargar,30000);
</script></body></html>`;
