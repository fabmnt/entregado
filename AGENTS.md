# Entregado

Entregado es un sistema web multi-negocio para que cada negocio gestione sus pedidos, productos y entregas. No es un sistema de pedidos general: todos los negocios usan una misma aplicación, base de datos y despliegue, pero cada uno gestiona sus operaciones de forma aislada.

La interfaz de usuario de Entregado se debe mantener simple y fácil de usar, las interfaces se destacan por formularios sencillos, pocas opciones de configuración por página/pantalla y flujos de trabajos resaltados a simple vista y accesibles.

La web general de Entregado lista los negocios registrados actualmente, de manera que los usuarios puedan encontrar rápida y fácilente los productos o servicios que necesiten. La web general es solo un enrutador, no muestra productos de negocios ya que esos son gestionados por la web Entregado del negocio registrado.

## Instrucciones generales

- Mantén siempre este proyecto sin errores de formateador, linter y tipos.
- Piensa a detalle cada vista o página que contiene interacción con el usuario y hazla lo más simple y limitada posible, siempre coloca detalles avanzados o campos de más personalización en una vista a parte.
- Resalta siempre los elementos que los usuarios usan en su día a día. Mantén un flujo de trabajo lo más ágil y simple posible.



Este proyecto está en fase desarrollo sin usuarios de producción, así que se pueden omitir restricciones para favorecer la rapidez del desarrollo.

## Convex

La persistencia compartida de la plataforma está en `packages/backend`. Un solo deployment Convex sirve a `apps/web` y `apps/business`. Antes de tocar funciones Convex, lee `packages/backend/convex/_generated/ai/guidelines.md`.

