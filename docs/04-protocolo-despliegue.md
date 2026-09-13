# Protocolo de despliegue — construir afuera, entregar adentro

Restricción real: por políticas de la empresa, el repo/código personal de
Eduardo (Claude Code, GitHub) no puede conectarse directamente al Google
Workspace de la compañía. Esto define dos entornos separados, sin puente
técnico entre ellos.

## Entorno de construcción (afuera)

- Repo propio en GitHub (cuenta personal de Eduardo), trabajado con Claude
  Code — este repositorio.
- Base de datos de prueba: un Google Sheet personal (no de la empresa) —
  se reutiliza `NEW_Bitacora.xlsx` como punto de partida; si algún módulo
  conviene recrearlo desde cero, se hace ahí mismo, afuera.
- Todo el desarrollo, pruebas y validación de cada fase ocurre 100% en este
  entorno. Usar `clasp` para desplegar del repo personal al Apps Script de
  prueba (también personal) es válido aquí — la restricción de "nunca
  `clasp push`" de la sección siguiente aplica solo al salto hacia el
  Workspace de la empresa, no a este ciclo interno. Ver
  `apps-script/README.md` (sección "Instalar en el Sheet personal de
  prueba") y `docs/09-deploy-clasp.md` para la configuración y un bug real
  ya corregido.
- Este código, al vivir en un repo propio y desacoplado de cualquier
  cliente específico, es reutilizable como parte del repertorio de
  Órbita 360 (mismo patrón que HotelOS: producto propio, adaptable a otros
  clientes/equipos operativos).

## Entorno de entrega (adentro, Workspace de la empresa)

- Un proyecto de Apps Script nuevo, ligado a un Google Sheet propiedad de
  la empresa, dentro de la cuenta de Workspace del trabajo de Eduardo.
- Cuando un módulo (o la plataforma completa) queda terminado y probado
  afuera, los archivos fuente finales (`.gs`/`.html`/`.js`) se copian
  **manualmente** a ese proyecto — nunca vía `clasp push` automático ni
  ninguna conexión directa desde el repo personal. La copia se hace desde
  `apps-script/dist-gas/` (generado con `npm run build:gas`), no desde
  `src/`/`html/` por separado — es plano (sin subcarpetas), así que cada
  archivo se copia con su nombre exacto sin reconstruir ninguna carpeta a
  mano. Ver `docs/09-deploy-clasp.md`.
- El código se copia; **los datos no**. La primera vez que un módulo se
  instala en el Sheet de la empresa, alguien debe cargar a mano los
  `Users`/`User_Roles`/`Departments` reales de Executive Services — la data
  de prueba de afuera (Eduardo=Manager, Carlos Riviera, etc.) nunca debe
  llegar al Sheet de la empresa.
- A partir de ahí, esa copia vive y se mantiene dentro de Workspace;
  ajustes menores pueden hacerse directo en el editor de Apps Script de la
  empresa si hace falta, sin depender del entorno externo.

Esta separación no cambia nada de la arquitectura técnica del resto del
proyecto (Apps Script + Sheets, capa Repository/DAO, etc.) — solo define el
procedimiento de entrega.
