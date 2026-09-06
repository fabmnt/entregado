# Entregado

Pedidos, inventario y entrega para negocios en Nicaragua. Cada negocio tiene su
propia web (tienda + admin). Esta web general lista los negocios y es donde se
registran.

## Apps y paquetes

- `apps/web` — web general (directorio y registro), puerto 4321
- `apps/business` — web del negocio (tienda y admin), puerto 4322
- `packages/ui` — componentes shadcn (Base UI)
- `packages/types` — tipos y constantes del dominio
- `packages/utils` — helpers compartidos (teléfono +505, C$)
- App móvil: más adelante, en este mismo monorepo

## Comandos

```bash
pnpm install
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
