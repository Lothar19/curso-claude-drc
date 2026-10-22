import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Table, TableStatus } from '../models/table.model';
import { TableService } from '../services/table.service';

const ERROR_MESSAGES: Record<string, string> = {
  TableNotFoundError: 'La mesa ya no existe. Se ha recargado la lista.',
  InvalidTableStatusError: 'Estado de mesa no válido.'
};

@Injectable({ providedIn: 'root' })
export class TableStore {
  private readonly tableService = inject(TableService);

  private readonly _tables = signal<Table[]>([]);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);

  private pollingInterval: ReturnType<typeof setInterval> | null = null;

  readonly tables = this._tables.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();

  async loadTables(restaurantId: string): Promise<void> {
    this._loading.set(true);
    try {
      const tables = await firstValueFrom(this.tableService.getTables(restaurantId));
      this._tables.set([...tables].sort((a, b) => a.number - b.number));
      this._error.set(null);
    } catch (err: any) {
      this._error.set(this.translateError(err, 'Error al cargar mesas'));
    } finally {
      this._loading.set(false);
    }
  }

  async changeStatus(restaurantId: string, tableId: string, status: TableStatus): Promise<void> {
    this._error.set(null);
    try {
      const updated = await firstValueFrom(
        this.tableService.changeStatus(restaurantId, tableId, { status })
      );
      this._tables.update(tables => tables.map(t => (t.id === tableId ? updated : t)));
    } catch (err: any) {
      const message = this.translateError(err, 'Error al cambiar el estado de la mesa');
      if (err?.error?.error === 'TableNotFoundError') {
        await this.loadTables(restaurantId);
      }
      this._error.set(message);
    }
  }

  startPolling(restaurantId: string): void {
    this.stopPolling();
    this.loadTables(restaurantId);
    this.pollingInterval = setInterval(() => {
      this.loadTables(restaurantId);
    }, 30000);
  }

  stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  /** Traduce por el nombre de clase de error (`error.error.error`); los mensajes de la API van en inglés. */
  private translateError(err: any, fallback: string): string {
    const name: string | undefined = err?.error?.error;
    return (name && ERROR_MESSAGES[name]) || fallback;
  }
}
