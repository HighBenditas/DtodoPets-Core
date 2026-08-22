# DTodoPets Core Backend

API NestJS del ecosistema DTodoPets. La documentación principal está en el
[`README.md`](../README.md) de la raíz y en [`docs/`](../docs/).

## Desarrollo rápido

```bash
npm ci
npm run prisma:generate
npm run start:dev
```

## Validación

```bash
npm run prisma:format
npm run check
npm run test:e2e
```

No edites `src/generated/prisma`, no confirmes archivos `.env` y no ejecutes
`prisma migrate reset` sobre una base con datos útiles.
