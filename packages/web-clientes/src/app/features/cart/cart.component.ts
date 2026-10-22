import { Component, inject, signal, computed } from '@angular/core'
import { Router, RouterLink } from '@angular/router'
import { DecimalPipe } from '@angular/common'
import { CartStore } from '../../core/store/cart.store'
import { OrderService } from '../../core/services/order.service'
import { HttpErrorResponse } from '@angular/common/http'

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [RouterLink, DecimalPipe],
  template: `
    <div class="container">
      <div class="page-header">
        <h1>Tu pedido</h1>
      </div>

      @if (cartStore.items().length === 0) {
        <div class="empty-state card">
          <p>Tu carrito está vacío</p>
          <a routerLink="/restaurants" class="btn btn-primary" style="margin-top: 16px;">
            Ver restaurantes
          </a>
        </div>
      } @else {
        <div class="cart-layout">
          <div class="cart-items">
            @for (item of cartStore.items(); track item.dish.id) {
              <div class="cart-item card">
                <div class="item-info">
                  <h3>{{ item.dish.name }}</h3>
                  <p class="item-price">{{ item.dish.price | number:'1.2-2' }} € / ud</p>
                </div>
                <div class="item-controls">
                  <div class="quantity-selector">
                    <button class="qty-btn" (click)="decrement(item.dish.id)">-</button>
                    <span>{{ item.quantity }}</span>
                    <button class="qty-btn" (click)="increment(item.dish.id)">+</button>
                  </div>
                  <span class="item-subtotal">{{ item.dish.price * item.quantity | number:'1.2-2' }} €</span>
                  <button class="btn btn-danger btn-sm" (click)="remove(item.dish.id)">Eliminar</button>
                </div>
              </div>
            }
          </div>

          <aside class="order-summary card">
            <h3>Resumen</h3>
            @if (currentTable(); as table) {
              <div class="summary-row table-row">
                <span>Mesa {{ table.number }}</span>
                <span>{{ table.capacity }} pers.</span>
              </div>
            } @else {
              <p class="no-table">Aún no has elegido mesa.</p>
              <a [routerLink]="['/restaurants', cartStore.restaurantId(), 'mesa']" class="btn btn-secondary btn-sm">
                Elegir mesa
              </a>
            }
            <div class="summary-row">
              <span>Items ({{ cartStore.itemCount() }})</span>
              <span>{{ cartStore.total() | number:'1.2-2' }} €</span>
            </div>
            <div class="summary-row total">
              <span>Total</span>
              <strong>{{ cartStore.total() | number:'1.2-2' }} €</strong>
            </div>
            <button class="btn btn-primary" style="width: 100%; justify-content: center; margin-top: 16px;" 
                    [disabled]="loading() || !currentTable()" (click)="confirmOrder()">
              @if (loading()) {
                Confirmando...
              } @else if (error()) {
                Reintentar
              } @else {
                Confirmar pedido
              }
            </button>
            @if (error()) {
              <p class="error-msg">{{ error() }}</p>
            }
          </aside>
        </div>
      }
    </div>
  `,
  styles: [`
    .container {
      max-width: 900px;
      margin: 0 auto;
    }
    .cart-layout {
      display: grid;
      grid-template-columns: 1fr 320px;
      gap: 24px;
    }
    @media (max-width: 768px) {
      .cart-layout {
        grid-template-columns: 1fr;
      }
    }
    .cart-items {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .cart-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 20px;
    }
    .item-info h3 {
      font-size: 15px;
      font-weight: 600;
      margin-bottom: 4px;
    }
    .item-price {
      color: var(--text-muted);
      font-size: 13px;
    }
    .item-controls {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .quantity-selector {
      display: flex;
      align-items: center;
      gap: 8px;
      background: var(--bg-input);
      border-radius: var(--radius-sm);
      padding: 4px;
    }
    .qty-btn {
      width: 28px;
      height: 28px;
      border-radius: 4px;
      background: var(--bg-hover);
      color: var(--text-primary);
      font-weight: 600;
    }
    .qty-btn:hover {
      background: var(--green-glow);
      color: var(--green-light);
    }
    .item-subtotal {
      font-weight: 600;
      color: var(--text-primary);
      min-width: 80px;
      text-align: right;
    }
    .order-summary {
      position: sticky;
      top: 84px;
      height: fit-content;
    }
    .order-summary h3 {
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 16px;
    }
    .summary-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      color: var(--text-secondary);
    }
    .summary-row.total {
      border-top: 1px solid var(--border-color);
      margin-top: 8px;
      padding-top: 12px;
      font-size: 18px;
      color: var(--text-primary);
    }
    .table-row {
      color: var(--green-light);
      font-weight: 600;
    }
    .no-table {
      color: var(--text-muted);
      font-size: 13px;
      margin-bottom: 8px;
    }
    .error-msg {
      color: var(--red);
      text-align: center;
      margin-top: 8px;
      font-size: 13px;
    }
  `]
})
export class CartComponent {
  readonly cartStore = inject(CartStore)
  private readonly orderService = inject(OrderService)
  private readonly router = inject(Router)

  readonly loading = signal(false)
  readonly error = signal<string | null>(null)

  /** Mesa elegida, solo si es del restaurante del carrito. */
  readonly currentTable = computed(() => {
    const table = this.cartStore.table()
    return table && table.restaurantId === this.cartStore.restaurantId() ? table : null
  })

  increment(dishId: string): void {
    const item = this.cartStore.items().find(i => i.dish.id === dishId)
    if (item) {
      this.cartStore.updateQuantity(dishId, item.quantity + 1)
    }
  }

  decrement(dishId: string): void {
    const item = this.cartStore.items().find(i => i.dish.id === dishId)
    if (item) {
      this.cartStore.updateQuantity(dishId, item.quantity - 1)
    }
  }

  remove(dishId: string): void {
    this.cartStore.removeItem(dishId)
  }

  confirmOrder(): void {
    const restaurantId = this.cartStore.restaurantId()
    const table = this.currentTable()
    if (!restaurantId || !table || this.cartStore.items().length === 0) return

    this.loading.set(true)
    this.error.set(null)

    const items = this.cartStore.items().map(item => ({
      dishId: item.dish.id,
      quantity: item.quantity,
      notes: item.notes || null
    }))

    this.orderService.createOrder(restaurantId, table.tableId, items).subscribe({
      next: (order) => {
        this.cartStore.clear()
        this.router.navigate(['/orders', order.id])
      },
      error: (err: HttpErrorResponse) => {
        const apiError = err.status === 400 ? err.error?.error : null
        if (apiError === 'Table not found' || apiError === 'Table is not occupied') {
          // La mesa guardada ya no es válida: se olvida y se vuelve a elegir (el carrito se conserva)
          this.cartStore.clearTable()
          const notice = apiError === 'Table not found'
            ? 'La mesa que tenías ya no existe. Elige una mesa para continuar con tu pedido.'
            : 'Tu mesa ya no está ocupada (puede que el personal la haya liberado). Elige una mesa para continuar con tu pedido.'
          this.router.navigate(['/restaurants', restaurantId, 'mesa'], { state: { notice } })
          return
        }
        this.error.set('Error al confirmar el pedido. Inténtalo de nuevo.')
        this.loading.set(false)
      }
    })
  }
}
