# Bug de despliegue: `clasp push` y los archivos HTML — causa y corrección

## El bug

Eduardo desplegó Fase 4 usando `clasp push` con `rootDir` apuntando a la
raíz de `apps-script/` (que contiene `src/` y `html/` como subcarpetas).
Apps Script (y `clasp`, que solo refleja cómo Apps Script nombra sus
archivos) identifica cada archivo por su nombre completo — no hay
carpetas reales, son parte del nombre. Al subir `html/Index.html` con ese
`rootDir`, el archivo quedó registrado adentro del proyecto como
`html/Index`, no como `Index`.

Pero:
- `src/99_WebApp.js` llama `HtmlService.createTemplateFromFile('Index')`.
- `html/Index.html` llama `include('Styles')`, `include('Client_Api')`, etc.

Ninguna de esas referencias tenía el prefijo `html/`, así que Apps Script
tiraba `No se encontró el archivo HTML llamado Index` al abrir el Web App.
Eduardo lo corrigió a mano en el editor (agregando `html/` a las 7
referencias) para poder probar — un parche que un siguiente `clasp push`
desde el repo iba a volver a romper, porque el repo seguía sin el prefijo.

## Por qué el arreglo NO es agregar `html/` en el código

Agregar `html/` a las 7 referencias en el repo (`99_WebApp.js` + las 6
`include(...)` de `Index.html`) habría *parchado* el síntoma para el flujo
de `clasp push` con ese `rootDir` puntual, pero:

- Rompe la copia manual archivo-por-archivo (`docs` previos de este
  proyecto documentaban pegar cada archivo de `html/` con su nombre tal
  cual — sin ningún prefijo — directo en el editor de Apps Script).
- Sigue siendo frágil ante cualquier cambio futuro de `rootDir` o de cómo
  se invoque `clasp`.
- Trata el síntoma (el nombre no matchea) en vez de la causa (el repo
  tiene una subcarpeta que Apps Script no tiene).

## La corrección permanente: aplanar antes de desplegar

`apps-script/scripts/build-gas.js` genera `apps-script/dist-gas/` — un
directorio **plano**, sin subcarpetas, con `src/*.js` + `html/*.html` +
`appsscript.json` todos al mismo nivel. Es, literalmente, una copia en
disco de cómo luce un proyecto de Apps Script por dentro (que no tiene
carpetas). A partir de ahora:

- `clasp` (`apps-script/.clasp.json`, plantilla en `.clasp.json.example`)
  apunta su `rootDir` a `./dist-gas`, nunca a la raíz de `apps-script/`.
- La copia manual también se hace archivo por archivo desde `dist-gas/`,
  no desde `src/`+`html/` por separado.

Con esto, **ningún** método de despliegue puede volver a introducir un
prefijo de carpeta — no porque alguien se acuerde de corregirlo, sino
porque la estructura que se sube ya no tiene carpetas que preservar. `src/`
y `html/` siguen separados en el repo por legibilidad (lógica de negocio
vs. plantillas); `dist-gas/` es un artefacto generado (gitignored, se
regenera con `npm run build:gas` antes de cada deploy) — nunca se edita a
mano.

`test/loadGas.js` (usado por los tests de backend) y `devserver/server.js`
(usado por `npm run dev` y los specs e2e) siguen leyendo `src/` y `html/`
directamente, sin pasar por `dist-gas/` — no lo necesitan, porque ninguno
de los dos tiene el problema de "subcarpeta preservada en el nombre" que
sí tiene `clasp push`/la copia manual a Apps Script real.

## El chequeo que lo hubiera detectado antes de desplegar

Dos tests nuevos, con roles distintos a propósito:

- **`test/htmlReferences.test.js`** — estático, sobre el código fuente tal
  cual vive en el repo: escanea `src/*.js` + `html/*.html` buscando
  `include(...)`/`createTemplateFromFile(...)`/`createHtmlOutputFromFile(...)`
  con un nombre literal entre comillas, y verifica que
  `apps-script/html/<nombre>.html` exista. Atrapa typos o referencias a
  archivos que nunca existieron — pero **no** habría atrapado el bug real,
  porque el código fuente siempre estuvo bien escrito (sin el prefijo); el
  problema vivía en el artefacto subido, no en el repo.
- **`test/buildGas.test.js`** — este sí es el que hubiera detectado el bug
  real: corre `build-gas.js` y verifica (a) que `dist-gas/` no contenga
  ninguna subcarpeta, y (b) que cada nombre referenciado por
  `include(...)`/`createTemplateFromFile(...)` exista como archivo plano
  en `dist-gas/` — validando el artefacto que de verdad se sube, no el
  código fuente. Se confirmó manualmente que este test falla si se
  reintroduce el patrón exacto del bug (una referencia tipo
  `createTemplateFromFile('html/Index')`).

Ambos corren con `npm test` (ya incluidos en `test/*.test.js`).
