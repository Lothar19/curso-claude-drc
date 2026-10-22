# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Resttek

Plataforma de gestión de restaurantes: panel de administración, app para empleados (cocina, barra y salón) y app de pedidos para clientes, sobre una API Node.js. Proyecto base de un curso de desarrollo con IA. La documentación se escribe en español. Detalle ampliado en [`docs/`](./docs) y [`README.md`](./README.md).

Monorepo con npm workspaces (Node 22+, npm 10+): `packages/api` (Express 5 + TypeScript ESM + SQLite, :3000), `web-admin` (:4200), `web-empleados` (:4201), `web-clientes` (:4202) (los tres Angular 21) y `web-shared` (librería Angular compartida).

## Comandos

Desde la raíz:

```bash
npm install            # una sola vez, instala todos los workspaces
npm run seed           # datos de prueba (idempotente, INSERT OR IGNORE)
npm run dev:api        # API con hot-reload (tsx watch)
npm run dev:admin      # | dev:empleados | dev:clientes
npm test               # solo tests de la API (Vitest)
```

Tests de la API (hay que estar en `packages/api`):

```bash
npx vitest run src/services/order.service.test.ts   # un fichero
npx vitest run -t "nombre del test"                 # por nombre
npm run test:watch
```

Build de un frontend: `npm run build -w @resttek/web-admin` (análogo para los otros). **No hay linter configurado** ni tests de frontend; `npm test` solo cubre la API.

Healthcheck: `GET /health` (sin prefijo `/api/v1`). Los frontends hacen proxy de `/api` a `localhost:3000` (`proxy.conf.json`), así que se accede siempre por el puerto del frontend.

Credenciales tras el seed: la contraseña es el propio email (`admin@resttek.com`, `gerente1@…`, `cocinero1@…`, `camarero1@…`, `cliente1@…`). Restaurantes: `rest-1` y `rest-2`.

## Arquitectura de la API (`packages/api/src`)

Conviven **dos estilos**; identifica cuál aplica antes de tocar código:

- **Hexagonal + DDD** solo en `contexts/employee/` (`domain` → `application` → `infrastructure`). `Employee` es la única entidad con comportamiento (constructor privado + `create()`); casos de uso con `execute()`; interfaces con prefijo `I`. `contexts/shared/` guarda `Email`, middlewares y `errorHandler`. Los `Role` y `Email` son los únicos value objects como clase.
- **Por capas** para `restaurant`, `dish`, `ingredient`, `order`, `table`: `models/`, `repositories/`, `services/`, `controllers/`, `routes/`, un fichero por dominio. Objetos planos; la validación vive en servicios y en funciones `normalizeX()` de los modelos. Interfaz de repositorio sin prefijo `I`, en el mismo fichero que su implementación SQLite. La composición de dependencias se hace en el propio fichero de rutas (en `employee`, en `http/dependencies.ts`).

Detalles que sorprenden:

- Alias de path (`@models/*`, `@services/*`, `@employee/*`, `@shared/*`…) en `tsconfig.json`; los imports llevan extensión `.js` (ESM, `nodenext`).
- Auth JWT: `authenticate` (401) y `authorize(roles)` (403) responden directamente, sin pasar por el `errorHandler`. Los routers bajo `/restaurants/:restaurantId/...` necesitan `mergeParams: true`.
- Errores: `AppError` → `errors/DomainErrors.ts`; el `errorHandler` decide el HTTP por nombre de clase (404 solo para `Employee/Restaurant/Ingredient/Dish/TableNotFoundError`, 409 para `DuplicatedTableNumberError`, `TableNotAvailableError` y `TableInUseError`, 401 `InvalidCredentialsError`, 400 el resto de `AppError`). `OrderNotFoundError` no está en la lista (da 400) y `OrderController` no usa `next(error)`: gestiona sus errores a mano, así que los errores de mesa de `POST /orders` (`Table not found`, `Table is not occupied`) llegan como 400 con `{ error: <mensaje> }`.
- Las rutas de pedidos no aplican `authorize()`; cualquier usuario autenticado puede cambiar el estado de un ítem.
- Al crear un pedido, un ítem con `quantity: 3` se guarda como 3 filas de `quantity: 1`. Si trae `tableId`, la mesa debe existir, ser del mismo restaurante y estar `ocupada`; los pedidos devuelven siempre `tableNumber` (entero o `null`).
- Contrato OpenAPI de las mesas (endpoints, roles, errores y decisiones de diseño): `docs/contratos/mesas.openapi.yaml`.
- BD: `config/database.ts` exporta una instancia única `dbConfig`; fichero `packages/api/resttek.db`, o `:memory:` si `NODE_ENV=test`. Las tablas se crean al arrancar (`CREATE TABLE IF NOT EXISTS`, sin sistema de migraciones).
- Tests unitarios junto al código, con dobles en `mocks/`. `supertest` está instalado pero no se usa: rutas y middlewares no tienen cobertura.

## Arquitectura del frontend

- Angular 21 con componentes standalone, signals, **zoneless** y guards/interceptors funcionales. RxJS solo para HTTP.
- `web-admin` y `web-empleados`: cada feature con `models/`, `pages/`, `services/`, `store/` (store con signals, HTTP envuelto en `firstValueFrom`). `web-clientes`: modelos, servicios y `cart.store.ts` en `core/`, features como componentes sueltos, con `.subscribe()` directo.
- `@resttek/web-shared` es el único código compartido (auth store/service/guard, interceptors, login/registro, estilos); los frontends no dependen entre sí. Tras cambiar `web-shared`, reinicia el servidor del frontend: Angular no detecta esos cambios.

## Convenciones

- `helpers/`: utilidades puras y reutilizables que no encajan en las demás capas (carpeta aún inexistente; créala en el paquete que la necesite).
- Documentación y comentarios de documentación en español. Estilo de la API: sin punto y coma, comillas simples.
- Antes de cambiar comportamiento, consulta `docs/revisiones/` (inconsistencias conocidas de backend y frontend).
- Este directorio no es un repositorio git.
