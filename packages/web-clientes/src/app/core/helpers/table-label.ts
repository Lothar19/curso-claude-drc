import { Order } from '../models/order.model'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Texto «Mesa N» de un pedido, o `null` si no hay mesa que mostrar.
 * Para pedidos antiguos con `tableId` de texto libre (sin `tableNumber`) usa el propio texto;
 * un UUID sin `tableNumber` (mesa borrada) no se muestra porque sería ilegible.
 */
export function getOrderTableLabel(order: Pick<Order, 'tableId' | 'tableNumber'>): string | null {
  if (order.tableNumber != null) return `Mesa ${order.tableNumber}`
  if (order.tableId && !UUID_REGEX.test(order.tableId)) return `Mesa ${order.tableId}`
  return null
}
