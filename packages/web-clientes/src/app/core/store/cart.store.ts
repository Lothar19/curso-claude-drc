import { Injectable, inject, signal, computed, effect } from '@angular/core'
import { AuthStore } from '@resttek/web-shared'

export interface Dish {
  id: string
  name: string
  description: string | null
  price: number
  category: string
  available: boolean
  restaurantId: string
  ingredients: { ingredientId: string; quantity: number }[]
}

export interface CartItem {
  dish: Dish
  quantity: number
  notes: string
}

export interface SelectedTable {
  userId: string
  restaurantId: string
  tableId: string
  number: number
  capacity: number
}

const TABLE_STORAGE_KEY = 'resttek.selectedTable'

@Injectable({ providedIn: 'root' })
export class CartStore {
  private readonly authStore = inject(AuthStore)
  private readonly _items = signal<CartItem[]>([])
  private readonly _restaurantId = signal<string | null>(null)
  private readonly _table = signal<SelectedTable | null>(this.loadTable())

  readonly items = this._items.asReadonly()
  readonly restaurantId = this._restaurantId.asReadonly()
  /** Mesa elegida; se trata como inexistente si pertenece a otro usuario o no hay sesión. */
  readonly table = computed(() => {
    const table = this._table()
    const userId = this.authStore.user()?.id
    return table && userId && table.userId === userId ? table : null
  })

  readonly total = computed(() =>
    this._items().reduce((sum, item) => sum + item.dish.price * item.quantity, 0)
  )

  readonly itemCount = computed(() =>
    this._items().reduce((count, item) => count + item.quantity, 0)
  )

  constructor() {
    // Si la sesión caduca o entra otro usuario, la mesa guardada se borra también de sessionStorage
    effect(() => {
      if (this._table() && !this.table()) {
        this.clearTable()
      }
    })
  }

  addItem(dish: Dish, quantity: number = 1, notes: string = ''): void {
    if (this._restaurantId() && this._restaurantId() !== dish.restaurantId) {
      this._items.set([])
    }
    this._restaurantId.set(dish.restaurantId)

    const existingIndex = this._items().findIndex(
      item => item.dish.id === dish.id && item.notes === notes
    )

    if (existingIndex >= 0) {
      const items = [...this._items()]
      items[existingIndex] = {
        ...items[existingIndex],
        quantity: items[existingIndex].quantity + quantity
      }
      this._items.set(items)
    } else {
      this._items.update(items => [...items, { dish, quantity, notes }])
    }
  }

  removeItem(dishId: string): void {
    const items = this._items().filter(item => item.dish.id !== dishId)
    this._items.set(items)
    if (items.length === 0) {
      this._restaurantId.set(null)
    }
  }

  updateQuantity(dishId: string, quantity: number): void {
    if (quantity <= 0) {
      this.removeItem(dishId)
      return
    }
    const items = this._items().map(item =>
      item.dish.id === dishId ? { ...item, quantity } : item
    )
    this._items.set(items)
  }

  clear(): void {
    this._items.set([])
    this._restaurantId.set(null)
  }

  setTable(table: Omit<SelectedTable, 'userId'>): void {
    const userId = this.authStore.user()?.id
    if (!userId) return
    const selected: SelectedTable = { ...table, userId }
    this._table.set(selected)
    try {
      sessionStorage.setItem(TABLE_STORAGE_KEY, JSON.stringify(selected))
    } catch {
      // sessionStorage no disponible: la mesa solo vive en memoria
    }
  }

  /** Olvida la mesa elegida (cierre de sesión o mesa que ya no es válida). `clear()` no la toca. */
  clearTable(): void {
    this._table.set(null)
    try {
      sessionStorage.removeItem(TABLE_STORAGE_KEY)
    } catch {
      // sessionStorage no disponible
    }
  }

  private loadTable(): SelectedTable | null {
    try {
      const raw = sessionStorage.getItem(TABLE_STORAGE_KEY)
      if (!raw) return null
      const t = JSON.parse(raw)
      if (typeof t?.userId === 'string' && typeof t?.restaurantId === 'string' && typeof t?.tableId === 'string'
        && typeof t?.number === 'number' && typeof t?.capacity === 'number') {
        return { userId: t.userId, restaurantId: t.restaurantId, tableId: t.tableId, number: t.number, capacity: t.capacity }
      }
    } catch {
      // sessionStorage no disponible o contenido corrupto
    }
    return null
  }
}
