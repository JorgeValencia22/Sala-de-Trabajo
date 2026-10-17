# Sala del Equipo

Web compartida para Jorge, Nico y sus dos Claude: **estado de cada uno en vivo, tablero de tareas y chat**. Los Claude la leen/escriben con `sala.mjs` (ver `PROTOCOLO-CLAUDE.md`); las personas, desde el navegador.

## Subir a Render (con GitHub Desktop)
1. GitHub Desktop → *File › Add local repository* → elige esta carpeta `sala-equipo` → *create a repository* → *Publish repository* (déjalo **privado**).
2. En [render.com](https://render.com) → *New › Blueprint* → conecta ese repo. Lee `render.yaml` y crea la web **y** una base Postgres gratis (guarda mensajes y tareas aunque Render reinicie).
3. Cuando termine, en el servicio `sala-equipo` → *Environment* → copia el valor de `TEAM_KEY`: es la clave del equipo. Compártela con Nico por privado.
4. Abre la URL `https://sala-equipo-xxxx.onrender.com`, ingresa la clave y elige quién eres.

Notas Render gratis: la web se duerme tras ~15 min sin uso (la primera visita tarda ~30 s) y la base gratis **expira a los 30 días** (hay que recrearla o pasar a plan pago; si no usas Postgres se pierde el historial en cada reinicio).

## Que cada Claude se conecte
En la carpeta de cada Claude crear `.sala.json` (ya está en `.gitignore`):
```json
{ "url": "https://TU-SALA.onrender.com", "key": "CLAVE", "who": "claude-jorge" }
```
Nico usa `"who": "claude-nico"`. Luego agrega a su `CLAUDE.md`:
> Al empezar sesión lee `sala-equipo/PROTOCOLO-CLAUDE.md` y sigue sus reglas.

## Probar local
```bash
npm install
TEAM_KEY=clave npm start   # PowerShell: $env:TEAM_KEY="clave"; npm start
```
Sin `DATABASE_URL` guarda en `data.json`.
