import { Component, inject, OnInit, OnDestroy, computed } from '@angular/core';
import { AuthStore } from '@resttek/web-shared';
import { OrderStore } from '../../../orders/store/order.store';
import { Order } from '../../../orders/models/order.model';
import { TableStore } from '../../store/table.store';
import { Table, TableStatus, TABLE_STATUSES } from '../../models/table.model';

@Component({
  selector: 'app-mesas',
  standalone: true,
  templateUrl: './mesas.component.html',
  styleUrl: './mesas.component.css'
})
export class MesasComponent implements OnInit, OnDestroy {
  private readonly authStore = inject(AuthStore);
  readonly tableStore = inject(TableStore);
  readonly orderStore = inject(OrderStore);

  readonly statuses = TABLE_STATUSES;

  /** Pedidos activos agrupados por id de mesa (`order.tableId === table.id`). */
  readonly ordersByTable = computed(() => {
    const map = new Map<string, Order[]>();
    for (const order of this.orderStore.orders()) {
      if (!order.tableId) continue;
      map.set(order.tableId, [...(map.get(order.tableId) ?? []), order]);
    }
    return map;
  });

  ngOnInit(): void {
    const restaurantId = this.authStore.user()?.restaurantId;
    if (restaurantId) {
      this.tableStore.startPolling(restaurantId);
      this.orderStore.startPolling(restaurantId);
    }
  }

  ngOnDestroy(): void {
    this.tableStore.stopPolling();
    this.orderStore.stopPolling();
  }

  ordersOf(table: Table): Order[] {
    return this.ordersByTable().get(table.id) ?? [];
  }

  pendingItemsCount(table: Table): number {
    return this.ordersOf(table).reduce(
      (total, order) => total + order.items.filter(item => item.status !== 'entregado').length,
      0
    );
  }

  changeStatus(table: Table, status: TableStatus): void {
    const restaurantId = this.authStore.user()?.restaurantId;
    if (!restaurantId || status === table.status) return;

    const pending = this.pendingItemsCount(table);
    if (table.status === 'ocupada' && status === 'libre' && pending > 0) {
      const confirmed = confirm(
        `La mesa ${table.number} tiene ${pending} producto(s) sin entregar. ¿Liberarla de todos modos?`
      );
      if (!confirmed) return;
    }
    this.tableStore.changeStatus(restaurantId, table.id, status);
  }

  getStatusClass(status: string): string {
    return `badge badge-${status}`;
  }
}
