# Entregado

Pedidos, inventario y entrega para negocios en Nicaragua. Cada negocio tiene su
propia tienda y panel dentro de una aplicación compartida. Todos los negocios
usan una misma base de datos y despliegue, con sus operaciones aisladas. Esta
web general lista los negocios y es donde se registran.

## Apps y paquetes

- `apps/web` — web general (directorio y registro), puerto 4321
- `apps/business` — una sola aplicación para todos los negocios (tienda y
  admin), puerto 4322. El aislamiento es por negocio (slug o subdominio), no
  por deploy
- `packages/backend` — Convex compartido: un deployment, muchos negocios
- `packages/ui` — componentes shadcn (Base UI)
- `packages/types` — tipos y constantes del dominio
- `packages/utils` — helpers compartidos (teléfono +505, C$)
- App móvil: más adelante, en este mismo monorepo

## Comandos

```bash
pnpm install
pnpm dev:backend
pnpm dev:web
pnpm dev:business
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Componentes UI

Desde la raíz:

```bash
pnpm dlx shadcn@latest add button -c apps/web
```
