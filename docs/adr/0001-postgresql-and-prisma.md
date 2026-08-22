# ADR 0001: PostgreSQL y Prisma

- Estado: aceptado
- Fecha: 2026-08-22

## Contexto

El proyecto ya utiliza PostgreSQL 18, Prisma 7 y una migración aplicada de
`Organization`. El ecosistema requiere relaciones, constraints, transacciones e
índices confiables.

## Decisión

Conservar PostgreSQL como base transaccional y Prisma como esquema, cliente y
sistema de migraciones. Las migraciones serán pequeñas, progresivas y revisadas.

## Consecuencias

Se preserva el trabajo existente y el tipado. Operaciones de concurrencia crítica
pueden requerir niveles de aislamiento, transacciones interactivas o SQL
específico documentado, sin abandonar Prisma como camino principal.
