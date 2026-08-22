# ADR 0002: Monolito modular y tenant por organización

- Estado: aceptado
- Fecha: 2026-08-22

## Contexto

El proyecto está en una etapa temprana y necesita muchos dominios fuertemente
transaccionales. Microservicios aumentarían el costo operacional sin resolver un
problema medido. DTodoPets necesita aislamiento por organización desde el inicio.

## Decisión

Construir un monolito modular NestJS. `Organization` será el límite de tenant y
las entidades de negocio incluirán relaciones/constraints apropiadas. El tenant
se obtendrá de la identidad autenticada.

## Consecuencias

Las transacciones permanecen locales y el despliegue es simple. Los módulos
deben evitar acceso cruzado informal y exponer contratos internos claros para
permitir extracción futura cuando exista una razón operacional.
