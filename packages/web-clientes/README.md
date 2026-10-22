# RestTek - Web Clientes

Aplicación Angular para que los clientes de un restaurante consulten la carta, hagan pedidos y sigan su estado.

## Requisitos

- Node.js 22+
- npm 10+

## Instalación

```bash
npm install
```

## Desarrollo

Para iniciar el servidor de desarrollo:

```bash
npm start
```

La aplicación estará disponible en `http://localhost:4202`

## Funcionalidades

### Restaurantes
- Listado de restaurantes disponibles.

### Selección de mesa
- Al elegir un restaurante, antes de ver la carta hay que elegir mesa (`/restaurants/:id/mesa`): se indica el número de personas (1 a 20; solo se valida en el cliente), se listan las mesas libres con capacidad suficiente (`GET /restaurants/:restaurantId/tables/available?people=N`) y «Continuar» ocupa la mesa elegida (`POST .../tables/:id/occupy`) y lleva a la carta.
- Si otro cliente se adelanta (409) o la mesa ya no existe (404), se avisa y se recarga la lista con el mismo número de personas.
- La mesa elegida se guarda en `CartStore` y en `sessionStorage` junto con el `userId` del cliente (sobrevive a una recarga, no a cerrar la pestaña). Si la sesión caduca o entra otro usuario en la misma pestaña, la mesa se trata como inexistente y se borra, de modo que no se hereda. Un guard (`tableSelectedGuard`) redirige a la selección de mesa si se intenta abrir la carta sin mesa elegida para ese restaurante. Confirmar un pedido no olvida la mesa, de modo que se pueden hacer varios pedidos; se olvida al cerrar sesión, al perder la sesión o si la API rechaza el pedido por `Table not found` o `Table is not occupied` (se avisa y se vuelve a «Elegir mesa», conservando el carrito).
- Limitación conocida: no existe endpoint para liberar mesas desde el cliente. Si el cliente abandona sin pedir, cambia de restaurante o cierra la pestaña, la mesa queda `ocupada` hasta que un empleado la libere.

### Carta
- Consulta de la carta de un restaurante (platos por categoría: entrante, principal, postre, bebida).

### Carrito
- Añadir platos al carrito y confirmar el pedido.
- El pedido se envía con el `tableId` de la mesa elegida y el resumen muestra «Mesa N»; sin mesa del restaurante del carrito no se puede confirmar.
- El carrito es local (no se persiste vía API) y se vacía automáticamente si se añade un plato de un restaurante distinto al que ya había en curso.

### Pedidos
- "Mis pedidos": listado de los pedidos del cliente autenticado, con auto-refresco cada 10 segundos.
- Cada pedido muestra «Mesa N» (`tableNumber`); en pedidos antiguos con mesa de texto libre se muestra ese texto.
- Detalle de un pedido con el estado de cada ítem (`pendiente`, `preparando`, `listo`, `entregado`).

## Estructura del Proyecto

```
src/app/
├── core/
│   ├── guards/       # tableSelectedGuard (exige mesa elegida para abrir la carta)
│   ├── helpers/      # getOrderTableLabel (texto «Mesa N» de un pedido)
│   ├── layout/      # Shell component (navegación)
│   ├── models/       # Interfaces de Restaurant, Dish, Order, Table
│   ├── services/     # RestaurantService, DishService, OrderService, TableService (API calls)
│   └── store/         # CartStore (carrito y mesa elegida, local, sin HTTP)
└── features/
    ├── tables/        # Selección de mesa (personas, mesas libres, ocupar)
    ├── restaurants/   # Listado de restaurantes
    ├── menu/          # Carta de un restaurante
    ├── cart/           # Carrito y confirmación de pedido
    └── orders/         # Mis pedidos y detalle de pedido
```

A diferencia de `web-admin` y `web-empleados`, la mayoría de componentes de `features/` consumen los servicios HTTP directamente con `.subscribe()` en vez de pasar por un store: el único store con estado es `CartStore` (carrito y mesa elegida), que es puramente local.

## Build

Para hacer build de producción:

```bash
npm run build
```

Los archivos generados estarán en `dist/web-clientes/browser/`
