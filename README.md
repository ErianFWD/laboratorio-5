# Laboratorio #5 — API de notas con Claude

Trabajo individual: notas, validación, Swagger e integración con Claude en un único backend. Usa Node.js 20 o superior, Express 5 y JavaScript CommonJS. Las notas viven en memoria y se pierden al reiniciar el servidor, incluido un reinicio de `npm run dev`.

## Instalación y ejecución

Necesitás Node.js 20 o superior y npm en el PATH. Se recomienda Node.js 22, indicado en `.nvmrc`; la verificación de este laboratorio se hizo con Node.js 22.23.4 y npm 10.9.9. Desde la carpeta del repositorio:

```powershell
node --version
npm --version
npm ci
Copy-Item .env.example .env
npm start
```

Si `.env` ya existe, conservá su contenido: no vuelvas a copiar el ejemplo encima. Editá `.env` localmente para agregar tu clave; nunca la pegues en Swagger. En desarrollo podés usar:

```powershell
npm run dev
```

Este comando observa los archivos y reinicia Node al detectar cambios. Detené el servidor con `Ctrl+C`. No ejecutes ambos comandos a la vez en el mismo puerto.

- API: <http://localhost:3000>
- Swagger UI: <http://localhost:3000/api-docs>
- Contrato OpenAPI 3: <http://localhost:3000/api-docs/openapi.json>

Si cambiás `PORT`, usá ese puerto en las URLs. `GET /` devuelve `{ "documentacion": "/api-docs" }`. El acceso a `/api-docs` redirige a `/api-docs/`.

## Variables de entorno

| Variable | Valor del ejemplo | Uso |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | Vacío | Clave privada de Anthropic, usada exclusivamente en el backend. |
| `CLAUDE_MODEL` | `claude-haiku-4-5-20251001` | Modelo enviado a `messages.create`. |
| `PORT` | `3000` | Puerto HTTP entero entre 1 y 65535. |

`src/server.js` carga dotenv antes de importar la app y su configuración. Una variable ya definida en el proceso tiene prioridad sobre `.env`. La API puede iniciar sin clave y permite gestionar notas; las operaciones de IA devuelven 503 hasta configurar la clave. Un puerto o modelo vacío/inválido impide iniciar con un mensaje que no incluye valores privados.

`.gitignore` excluye `.env`, sus variantes locales y `node_modules/`; `.env.example` es la única excepción de entorno que se versiona. El archivo de bloqueo `package-lock.json` permite reinstalar las mismas dependencias con `npm ci`.

## Estructura

```text
src/
  server.js                  # dotenv y arranque HTTP
  app.js                     # composición de Express y Swagger
  config/                    # variables y contrato OpenAPI
  routes/                    # notas e IA
  services/                  # almacenamiento en memoria y cliente Claude
  middlewares/               # validación y errores centralizados
  utils/                     # AppError y esquemas Zod
test/                        # pruebas HTTP, SDK controlado y OpenAPI
```

## Las seis operaciones

| Método | Ruta | Body | Respuestas principales |
| --- | --- | --- | --- |
| GET | `/api/notas` | Ninguno | 200, lista de notas; inicialmente `[]`. |
| GET | `/api/notas/:id` | Ninguno | 200 o 404. |
| POST | `/api/notas` | `{ "titulo": "Tema", "contenido": "Texto" }` | 201 con nota y header `Location`, o 400. |
| DELETE | `/api/notas/:id` | Ninguno | 204 sin body, o 404. |
| POST | `/api/ia/preguntar` | `{ "pregunta": "¿Qué es Express?" }` | 200 con `{ respuesta, uso }`, 400, 429, 502 o 503. |
| POST | `/api/notas/:id/resumen` | Ninguno | 200 con `{ resumen, uso }`, 404, 429, 502 o 503. |

Zod elimina los espacios iniciales y finales y después valida: `titulo` entre 1 y 100 caracteres, `contenido` entre 1 y 5000 y `pregunta` entre 3 y 2000. Los campos son obligatorios y deben ser strings. No se admiten campos adicionales. JSON mal formado y cuerpos mayores que 64 KB devuelven 400. Los errores inesperados devuelven 500 sin stack.

Cada nota tiene `id` UUID, `titulo` y `contenido`. El resumen consulta la nota antes de invocar Claude: un ID inexistente responde 404 sin consumir una llamada. El resumen no modifica ni elimina la nota.

El servicio llama `messages.create`, pide respuestas en español y concatena únicamente los bloques de texto. En el resumen, `system` solicita exactamente tres viñetas breves y trata el título y contenido como datos. Los límites de salida son 512 tokens para preguntas y 256 para resúmenes, con timeout de 30 segundos y sin reintentos automáticos. `uso` conserva los contadores `input_tokens` y `output_tokens` recibidos del proveedor; no estima ni inventa consumo.

### Errores de IA

| Situación | Estado público | Código |
| --- | --- | --- |
| Límite de solicitudes del proveedor (429) | 429 | `IA_NO_DISPONIBLE` |
| Falta de clave, conexión, timeout, HTTP 408 o errores 5xx del proveedor, incluido 529 | 503 | `IA_NO_DISPONIBLE` |
| Clave rechazada (401), otros errores del proveedor o respuesta incompleta | 502 | `IA_NO_DISPONIBLE` |

El mensaje público es genérico: no devuelve la clave, headers, identificadores internos, stack ni el texto original del error de Anthropic. El 404 por nota inexistente usa `NOTA_NO_ENCONTRADA` y tiene prioridad sobre la disponibilidad de IA.

## Verificación realizada

```powershell
npm ci
npm test
```

- `npm ci`: instalación reproducible completada; la auditoría de esa instalación informó cero vulnerabilidades.
- `npm test`: **26 pruebas aprobadas**, sin fallos ni pruebas omitidas. Cubren CRUD, estados 200/201/204/400/404, límites de Zod, rechazo antes de llamar a IA, errores de conexión/timeout y del proveedor, preservación de contadores, Swagger y validez de OpenAPI 3.
- `npm start` y `npm run dev`: arranque comprobado con solicitudes HTTP reales a `/` y `/api-docs/`, ambas con 200.
- Llamada real a Anthropic con una clave deliberadamente falsa: **401 del proveedor → 502 de la API**, con `IA_NO_DISPONIBLE` y sin detalles internos. No se creó una captura de Swagger de esa prueba.

Las pruebas automáticas del SDK usan respuestas controladas mediante `fetch`; sus textos y contadores son fixtures y no acreditan una respuesta real ni consumo de Claude. Los ejemplos de Swagger también son ilustrativos. No había `.env` ni clave en el entorno al realizar la verificación; no se hicieron consultas con una clave válida.

| Evidencia de entrega | Estado |
| --- | --- |
| Pregunta libre con respuesta real de Claude | **Pendiente** de clave válida y captura en Swagger. |
| Resumen real de una nota en tres viñetas | **Pendiente** de clave válida y captura en Swagger. |
| Error 502 con clave falsa | Comportamiento real verificado; **captura en Swagger pendiente**. |
| Tokens de entrada/salida de la pregunta libre | **Pendientes**; copiar `uso` de la respuesta real. |
| Tokens de entrada/salida del resumen | **Pendientes**; copiar `uso` de la respuesta real. |

## Cómo obtener las tres capturas en Swagger

1. Configurá tu clave válida en `.env` y reiniciá el servidor. Si hay una variable `ANTHROPIC_API_KEY` definida en la terminal, actualizala o quitá esa variable de la sesión para que dotenv lea `.env`. Abrí `/api-docs`, desplegá **POST /api/ia/preguntar**, seleccioná **Try it out**, enviá el siguiente JSON y presioná **Execute**:

   ```json
   { "pregunta": "¿Qué función cumple un middleware en Express?" }
   ```

   Capturá la operación, el estado 200 y el body con `respuesta` y `uso`. Anotá los tokens reales. Un 502 puede indicar que la clave fue rechazada o que el modelo no está disponible; verificá la configuración antes de repetir. Una respuesta de error no cumple esta evidencia.

2. En **POST /api/notas**, creá una nota con el body siguiente y copiá el `id` que devuelve el 201:

   ```json
   {
     "titulo": "Repaso del laboratorio",
     "contenido": "Express organiza las rutas de la API. Zod valida las solicitudes antes de procesarlas. La clave de Claude permanece en el backend. Swagger permite probar los endpoints. Git registra avances mediante commits."
   }
   ```

   En **POST /api/notas/{id}/resumen**, presioná **Try it out**, pegá ese ID y ejecutá sin body. Capturá el estado 200 y el `resumen` real; comprobá que sean tres viñetas breves en español y registrá `uso`. Si reiniciaste el servidor, tenés que crear la nota de nuevo.

3. Detené el servidor. Cambiá temporalmente la clave local por `clave-falsa-laboratorio-5`, reiniciá y ejecutá otra pregunta válida desde Swagger. Con acceso a Anthropic, debe verse **502** con este body:

   ```json
   {
     "error": {
       "codigo": "IA_NO_DISPONIBLE",
       "mensaje": "El servicio de IA no está disponible. Intentá más tarde."
     }
   }
   ```

   Capturá la operación, el código y el body. Una clave vacía produce 503 y no sirve para esta captura. Si no hay conexión con Anthropic también se obtiene 503: resolvé la conexión y repetí, sin alterar ni fabricar el resultado. Restaurá tu clave válida o dejala vacía y reiniciá al terminar. No incluyás `.env`, la consola con credenciales ni una clave real en las capturas.

Todavía sin clave válida podés completar las pruebas CRUD, validar errores de entrada y obtener la captura de clave falsa si hay conexión al proveedor. Las dos capturas exitosas y sus tokens deben esperar una clave válida con acceso al modelo.

## Seis reflexiones

1. **Seguridad de la clave.** La clave pertenece al servidor porque habilita solicitudes con cargo a la cuenta. Se lee de `.env` después de cargar dotenv; no se manda al navegador, no forma parte del contrato Swagger ni se incluye en respuestas. Se versiona solo el ejemplo vacío y se revisa el staging antes de cada commit. Si una clave se publica, hay que revocarla y reemplazarla; quitarla del último archivo no elimina su presencia del historial.

2. **Manejo del 401 de Claude.** El 401 indica que Anthropic rechazó las credenciales del backend. El cliente de esta API no debe recibir los detalles privados del proveedor: el servicio lo convierte en 502 con `IA_NO_DISPONIBLE`. El servidor sigue atendiendo notas. Se verificó esta conversión tanto con el SDK controlado como con una llamada real con clave falsa; la captura de Swagger sigue pendiente.

3. **Diferencia entre `system` y `messages`.** `system` establece las instrucciones de comportamiento: idioma, brevedad y formato del resumen. `messages` lleva el contenido de la conversación, aquí un mensaje `user` con la pregunta o la nota serializada. No se coloca un rol `system` dentro de `messages`. En el resumen se indica que el contenido de la nota son datos para reducir el riesgo de que sus instrucciones cambien la tarea; el cumplimiento real de las tres viñetas se revisa en la captura pendiente.

4. **Consumo de tokens.** `input_tokens` refleja la entrada que procesó Claude y `output_tokens` su salida. El texto, las instrucciones y la respuesta afectan el consumo. `max_tokens` limita la salida; no es el consumo medido ni limita por sí solo la entrada. Esta API devuelve los contadores del proveedor. **Pendiente:** registrar los valores reales de una pregunta y un resumen; no se sustituyen por números de las pruebas ni ejemplos. No se ha comprobado un costo real.

5. **Validación del body.** El contenido HTTP es entrada no confiable. Zod comprueba presencia, tipos, longitudes y campos adicionales después de recortar espacios. Un body inválido recibe 400 antes de guardar una nota o llamar a Claude, evitando datos inconsistentes y solicitudes innecesarias. El parser JSON y el middleware central también transforman JSON roto o cuerpos excesivos en errores JSON controlados.

6. **Integración con Git: flujo individual real.** Se revisaron estado, rama, `origin` y archivos antes de editar. El repositorio estaba vacío, `main` no tenía commits y `origin` tampoco tenía referencias. Se creó `feature/laboratorio-5`; una sola persona cubre notas, Swagger y Claude. Se implementaron y verificaron avances en cinco commits: configuración; CRUD y Zod; Claude y errores; Swagger; y este README con reflexiones y evidencias. Antes de cada commit se revisaron los archivos preparados, el diff y posibles secretos. No hubo merge, revisión de compañeros ni resolución de conflictos que reportar. El push y el pull request quedan a cargo del autor.

## Entrega mediante Git

```powershell
git status
git log --oneline feature/laboratorio-5
git push -u origin feature/laboratorio-5
```

No se ejecutó el push ni se abrió un pull request. Como `origin` comenzó vacío y `main` no tiene historial, antes de abrir el PR habrá que establecer una rama base con historial compartido, por ejemplo `main`. La definición y publicación de esa base también quedan pendientes.

## Referencias

- [SDK oficial de Anthropic: Messages, errores, timeout y reintentos](https://github.com/anthropics/anthropic-sdk-typescript).
- [Errores de la API de Claude](https://platform.claude.com/docs/en/api/errors).
- [Manejo de errores de Express 5](https://expressjs.com/en/5x/guide/error-handling/).
- [Validación y safeParse en Zod](https://zod.dev/basics).
