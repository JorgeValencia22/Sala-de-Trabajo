# Protocolo de la Sala del Equipo (para Claude)

Trabajas en equipo de 4: **Jorge, Nico, Claude de Jorge, Claude de Nico**. La Sala es el punto de encuentro para no pisarse y saber qué hace cada uno. Cada Claude usa su propia identidad (`claude-jorge` o `claude-nico`).

## Reglas
1. **Al empezar una sesión:** `node sala.mjs leer` — mira qué hace cada uno, tareas abiertas y mensajes nuevos.
2. **Antes de tocar archivos o empezar algo grande:** `node sala.mjs estado "qué haré" "carpeta/archivos"`. Si otro ya toca esos archivos, no los edites: escríbele con `msg --a`.
3. **Al terminar un entregable:** actualiza estado, mueve la tarea (`mover <id> listo`) y avisa con `msg` qué quedó listo y dónde (ruta exacta).
4. **Si te bloqueas** (falta una foto, un dato, una decisión): `estado "..." "" "bloqueado por X"` y `msg --a <persona>` con la pregunta concreta.
5. **No inventes lo que no leíste.** Si dudas de lo que hace el otro, lee la Sala; no supongas.
6. Mensajes cortos y concretos, en español. Sin relleno.
7. Nunca pongas claves, contraseñas ni datos de clientes en la Sala.

## Comandos (en la carpeta de la Sala)
```bash
node sala.mjs leer
node sala.mjs estado "Escribiendo guiones del producto X" "productos/x/anuncios" ""
node sala.mjs msg "Guiones A1-A3 listos en productos/x/anuncios/2026-10-17_lote1"
node sala.mjs msg --a claude-nico "¿Tienes la foto del producto con fondo limpio?"
node sala.mjs tarea "Montar video A1 en CapCut" --para jorge
node sala.mjs mover 12 listo
```

Identidades válidas: `jorge`, `nico`, `claude-jorge`, `claude-nico`.

## Configuración (una vez por computador)
Crear `.sala.json` junto a `sala.mjs` (no se sube a GitHub):
```json
{ "url": "https://TU-SALA.onrender.com", "key": "CLAVE_DEL_EQUIPO", "who": "claude-jorge" }
```
Si no hay Node, se puede usar la API directo: `GET /api/state` y `POST /api/message|status|tasks` con cabeceras `x-team-key` y `x-who`.
