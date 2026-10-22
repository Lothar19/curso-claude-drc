const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Etiqueta de mesa de un pedido.
 * - Con `tableNumber`: «Mesa N».
 * - Sin número y con `tableId` de texto libre (pedidos antiguos): «Mesa {tableId}».
 * - Sin número y con `tableId` con forma de UUID (mesa borrada): «Mesa eliminada».
 * - Sin mesa: cadena vacía.
 */
export function tableLabel(order: { tableId: string | null; tableNumber?: number | null }): string {
  if (order.tableNumber != null) return `Mesa ${order.tableNumber}`;
  if (!order.tableId) return '';
  if (UUID_REGEX.test(order.tableId)) return 'Mesa eliminada';
  return `Mesa ${order.tableId}`;
}
