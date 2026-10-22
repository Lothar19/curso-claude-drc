# RestTek - Web Empleados

Aplicación Angular para empleados del restaurante (Camareros, Cocineros, Gerentes).

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

La aplicación estará disponible en `http://localhost:4201`

## Roles y Permisos

### Camarero
- **Barra**: Ve bebidas pendientes y puede marcarlas como "Listo"
- **Salón**: Ve productos listos para entregar y puede marcarlos como "Entregado"

- **Mesas**: Ve la rejilla de mesas del restaurante y cambia su estado (libre, ocupada, reservada)

### Cocinero
- **Cocina**: Ve platos pendientes y en preparación, puede:
  - Marcar como "Preparando" (pendiente → preparando)
  - Marcar como "Listo" (preparando → listo)

### Gerente
- Acceso completo a todas las secciones: Cocina, Barra, Salón y Mesas
- Puede realizar todas las acciones disponibles

## Estados de los Items

| Estado | Descripción | Color |
|--------|-------------|-------|
| `pendiente` | Item nuevo, esperando procesamiento | Amarillo |
| `preparando` | Item siendo preparado | Naranja |
| `listo` | Item listo para servir/entregar | Verde |
| `entregado` | Item entregado al cliente | Gris (desaparece de la vista) |

## Características

- **Auto-refresh**: Los pedidos se actualizan automáticamente cada 30 segundos
- **Diseño responsive**: Interfaz optimizada para tablets y pantallas de cocina
- **Notificaciones visuales**: Badges de color según estado del item

## Pantalla Mesas

Disponible para camarero y gerente (ruta `/mesas`). Muestra una tarjeta por mesa con número, capacidad, descripción y estado (`libre`, `ocupada`, `reservada`), y un selector para cambiarlo. En las mesas `ocupada` se listan los ítems de los pedidos activos, cruzando los pedidos por `order.tableId === table.id`.

- Pide confirmación antes de pasar una mesa de `ocupada` a `libre` si tiene ítems sin entregar.
- Si la mesa ha sido borrada mientras se cambiaba su estado (404 `TableNotFoundError`), se recarga la lista y se avisa.
- Mesas y pedidos se refrescan cada 30 segundos.
- Cocina, barra y salón muestran «Mesa N» usando `tableNumber`. Los pedidos antiguos con `tableId` de texto libre muestran «Mesa {tableId}», y los de una mesa borrada, «Mesa eliminada».

## Estructura del Proyecto

```
src/app/
├── core/
│   └── layout/           # Shell component (sidebar + main content)
├── helpers/              # Funciones puras (etiqueta de mesa)
└── features/
    ├── tables/           # models, services, store (TableStore) y pages/mesas
    └── orders/
        ├── models/      # Interfaces de Order, OrderItem
        ├── services/    # OrderService (API calls)
        ├── store/       # OrderStore (state management con signals)
        └── pages/       # Cocina, Barra, Salon
```

## API Endpoints

La aplicación consume los siguientes endpoints del backend:

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/v1/orders/active?restaurantId=` | Obtener pedidos activos |
| PATCH | `/api/v1/orders/:orderId/items/:itemId/status` | Actualizar estado de item |
| GET | `/api/v1/restaurants/:restaurantId/tables` | Listar las mesas del restaurante |
| PATCH | `/api/v1/restaurants/:restaurantId/tables/:id/status` | Cambiar el estado de una mesa |

## Build

Para hacer build de producción:

```bash
npm run build
```

Los archivos generados estarán en `dist/web-empleados/browser/`
