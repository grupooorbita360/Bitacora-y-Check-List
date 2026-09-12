# Arquitectura general

## Rol de diseño

Senior Software Architect + Senior Backend/Full-Stack Developer + UX/UI
Product Designer + Business Process Analyst, sobre una plataforma operativa
interna web — no una app de productividad genérica.

## Separación de capas

```
Identity/Authentication → Organization → Roles/Permissions →
Data/Repository → Business Logic/Services → Presentation/API → Frontend
```

Estas responsabilidades nunca se mezclan en una sola función. La capa de
datos (Repository/DAO) es la única que conoce el backend físico (hoy Sheets,
mañana Postgres/Supabase); la lógica de negocio nunca llama
`SpreadsheetApp.getActive()` directamente.

## Jerarquía organizacional

```
Director → Manager → Supervisor → Agent
```

Más el rol técnico **Admin**, ortogonal a la jerarquía: un usuario puede ser
Director+Admin, Director sin Admin, o Admin sin Director. Hoy el nivel
Director existe en el modelo pero está **vacante** — ningún usuario real lo
ocupa todavía.

## Departamentos

Multi-departamento desde el diseño (Executive Services, Sales, Reservations,
Member Services, etc.) — nunca diseñar solo para Executive Services.

- **Manager**: responsable organizacional, pertenece a un único
  departamento. Acceso a otro departamento se resuelve con
  permisos/delegación, nunca con usuarios falsos ni cambiando su
  departamento real.
- **Supervisor**: supervisor directo del Agent.
- `Departments` es un catálogo formal (ver `01-modelo-datos.md`). El valor
  `GLOBAL` usado hoy en `Task_Permissions` y en accesos tipo Eduardo **no es
  un Department real** — es un alcance reservado del motor de permisos
  ("aplica a todos los departamentos"), nunca una fila de `Departments`.

## Auditabilidad y seguridad

- `Task_History` es inmutable — nunca se edita ni se borra, solo se agrega.
- Baja de registros vía soft-delete (`Active`), nunca borrado físico.
- PIN/passwords nunca en texto plano.
- `Login ID` y `Email` son conceptos distintos (un correo puede ser
  compartido por varios agentes); `Email` nunca es identidad única.

## Regla de oro de diseño

Antes de crear una tabla, columna o configuración nueva: **¿esta
información ya existe en otro lugar del modelo?** No duplicar conceptos, no
construir nada que no tenga una necesidad real y presente.

## Modularidad

La plataforma debe permitir agregar módulos nuevos (Objectives, Follow-up,
Board, People, Reports, Notifications, Integraciones) sin romper los
existentes. Ver `05-roadmap.md` para el orden de construcción por fases.
