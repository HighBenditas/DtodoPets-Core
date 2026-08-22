# API

Este documento distingue endpoints implementados de endpoints planificados.

## Implementados

| Método | Ruta | Auth | Descripción |
| --- | --- | --- | --- |
| GET | `/health` | No | Comprueba conectividad con PostgreSQL |
| GET | `/api/v1` | No | Devuelve nombre y versión de la API |
| POST | `/api/v1/organizations` | No, temporal | Crea una organización |
| GET | `/api/v1/organizations` | No, temporal | Lista organizaciones |
| GET | `/api/v1/organizations/:id` | No, temporal | Obtiene una organización |
| PATCH | `/api/v1/organizations/:id` | No, temporal | Actualiza nombre, slug o estado |
| DELETE | `/api/v1/organizations/:id` | No, temporal | Elimina una organización (204) |

Los DTO aplican whitelist y validación runtime. Los UUID de ruta se validan como
UUID v4. Conflictos Prisma `P2002` y registros ausentes `P2025` se mapean a HTTP.

## Contrato de errores

```json
{
  "statusCode": 400,
  "code": "VALIDATION_ERROR",
  "message": ["property unexpected should not exist"],
  "path": "/api/v1/organizations",
  "correlationId": "...",
  "timestamp": "2026-08-22T00:00:00.000Z"
}
```

Todos los endpoints incluyen `x-correlation-id`. Los endpoints administrativos
pasarán a Bearer auth en Identity.

## Planificados

`/api/v1/auth`, `/users`, `/organizations`, `/locations`, `/warehouses`,
`/products`, `/categories`, `/brands`, `/customers`, `/inventory`, `/orders`,
`/payments`, `/shipments`, `/channels`, `/integrations` y `/reports` se
documentarán aquí solo cuando existan.
