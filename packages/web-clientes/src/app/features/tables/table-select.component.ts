import { Component, inject, OnInit, OnDestroy, signal } from '@angular/core'
import { ActivatedRoute, Router, RouterLink } from '@angular/router'
import { HttpErrorResponse } from '@angular/common/http'
import { Subscription } from 'rxjs'
import { LucideAngularModule } from 'lucide-angular'
import { TableService } from '../../core/services/table.service'
import { CartStore } from '../../core/store/cart.store'
import { Table } from '../../core/models/table.model'

const MIN_PEOPLE = 1
const MAX_PEOPLE = 20

@Component({
  selector: 'app-table-select',
  standalone: true,
  imports: [RouterLink, LucideAngularModule],
  template: `
    <div class="container">
      <div class="page-header">
        <div>
          <a routerLink="/restaurants" class="back-link">← Volver a restaurantes</a>
          <h1>Elige tu mesa</h1>
          <p class="subtitle">Dinos cuántos sois y elige una de las mesas libres</p>
        </div>
      </div>

      @if (message()) {
        <div class="alert-error">{{ message() }}</div>
      }

      <div class="people-card card">
        <label class="people-label" for="people">
          <lucide-icon name="users" [size]="20"></lucide-icon>
          Número de personas
        </label>
        <div class="people-selector">
          <button type="button" class="qty-btn" [disabled]="people() <= minPeople || occupying()"
                  (click)="setPeople(people() - 1)" aria-label="Menos personas">-</button>
          <input id="people" type="number" class="form-control people-input"
                 [min]="minPeople" [max]="maxPeople" [value]="people()" [disabled]="occupying()"
                 (change)="onPeopleInput($event)">
          <button type="button" class="qty-btn" [disabled]="people() >= maxPeople || occupying()"
                  (click)="setPeople(people() + 1)" aria-label="Más personas">+</button>
        </div>
        <p class="people-hint">Entre {{ minPeople }} y {{ maxPeople }} personas</p>
      </div>

      @if (loading()) {
        <div class="spinner"></div>
      } @else if (loadError()) {
        <div class="alert-error">{{ loadError() }}</div>
      } @else if (tables().length === 0) {
        <div class="empty-state card">
          <lucide-icon name="armchair" [size]="32"></lucide-icon>
          <p>No hay mesas libres para {{ people() }} {{ people() === 1 ? 'persona' : 'personas' }} ahora mismo</p>
        </div>
      } @else {
        <div class="tables-grid">
          @for (table of tables(); track table.id) {
            <button type="button" class="table-card card" [class.selected]="selectedId() === table.id"
                    [disabled]="occupying()" (click)="selectedId.set(table.id)">
              <lucide-icon name="armchair" [size]="24"></lucide-icon>
              <h3>Mesa {{ table.number }}</h3>
              <p class="capacity">{{ table.capacity }} {{ table.capacity === 1 ? 'persona' : 'personas' }}</p>
              @if (table.description) {
                <p class="description">{{ table.description }}</p>
              }
            </button>
          }
        </div>
      }

      <div class="actions-bar">
        <button type="button" class="btn btn-primary" [disabled]="!selectedId() || occupying()" (click)="continue()">
          @if (occupying()) {
            Ocupando mesa...
          } @else {
            Continuar
          }
        </button>
      </div>
    </div>
  `,
  styles: [`
    .container {
      max-width: 800px;
      margin: 0 auto;
    }
    .back-link {
      font-size: 13px;
      color: var(--text-muted);
      margin-bottom: 8px;
      display: inline-block;
    }
    .subtitle {
      color: var(--text-muted);
      margin-top: 4px;
    }
    .people-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      margin-bottom: 24px;
    }
    .people-label {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 600;
    }
    .people-selector {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .qty-btn {
      width: 36px;
      height: 36px;
      border-radius: var(--radius-sm);
      background: var(--bg-hover);
      color: var(--text-primary);
      font-weight: 600;
      font-size: 18px;
    }
    .qty-btn:hover:not(:disabled) {
      background: var(--green-glow);
      color: var(--green-light);
    }
    .qty-btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
    .people-input {
      width: 80px;
      text-align: center;
      font-size: 18px;
      font-weight: 600;
    }
    .people-hint {
      color: var(--text-muted);
      font-size: 12px;
    }
    .tables-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
      gap: 16px;
    }
    .table-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      padding: 20px;
      color: var(--text-primary);
      text-align: center;
      cursor: pointer;
      transition: all var(--transition);
    }
    .table-card:hover:not(:disabled) {
      border-color: var(--green-medium);
    }
    .table-card.selected {
      border-color: var(--green-medium);
      background: var(--green-glow);
      color: var(--green-light);
    }
    .table-card h3 {
      font-size: 16px;
      font-weight: 600;
    }
    .capacity {
      color: var(--text-secondary);
      font-size: 13px;
    }
    .description {
      color: var(--text-muted);
      font-size: 12px;
    }
    .actions-bar {
      display: flex;
      justify-content: flex-end;
      margin-top: 24px;
    }
    .btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  `]
})
export class TableSelectComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute)
  private readonly router = inject(Router)
  private readonly tableService = inject(TableService)
  private readonly cartStore = inject(CartStore)
  private loadSub: Subscription | null = null
  private restaurantId = ''

  readonly minPeople = MIN_PEOPLE
  readonly maxPeople = MAX_PEOPLE

  readonly people = signal(2)
  readonly tables = signal<Table[]>([])
  readonly selectedId = signal<string | null>(null)
  readonly loading = signal(true)
  readonly occupying = signal(false)
  readonly loadError = signal<string | null>(null)
  readonly message = signal<string | null>(
    (this.router.getCurrentNavigation()?.extras.state?.['notice'] as string | undefined) ?? null
  )

  ngOnInit(): void {
    this.restaurantId = this.route.snapshot.paramMap.get('id')!

    // Si ya hay una mesa ocupada en este restaurante, se sigue con ella a la carta
    if (this.cartStore.table()?.restaurantId === this.restaurantId) {
      this.router.navigate(['/restaurants', this.restaurantId], { replaceUrl: true })
      return
    }
    this.loadTables()
  }

  ngOnDestroy(): void {
    this.loadSub?.unsubscribe()
  }

  setPeople(value: number): void {
    if (!Number.isInteger(value) || value < MIN_PEOPLE || value > MAX_PEOPLE) return
    this.people.set(value)
    this.message.set(null)
    this.loadTables()
  }

  onPeopleInput(event: Event): void {
    const input = event.target as HTMLInputElement
    const value = Number(input.value)
    if (!Number.isInteger(value) || value < MIN_PEOPLE || value > MAX_PEOPLE) {
      // Valor fuera de rango: se restaura el anterior
      input.value = String(this.people())
      this.message.set(`El número de personas debe estar entre ${MIN_PEOPLE} y ${MAX_PEOPLE}`)
      return
    }
    this.setPeople(value)
  }

  continue(): void {
    const table = this.tables().find(t => t.id === this.selectedId())
    if (!table || this.occupying()) return

    this.occupying.set(true)
    this.message.set(null)

    this.tableService.occupy(this.restaurantId, table.id).subscribe({
      next: (occupied) => {
        this.cartStore.setTable({
          restaurantId: this.restaurantId,
          tableId: occupied.id,
          number: occupied.number,
          capacity: occupied.capacity
        })
        this.router.navigate(['/restaurants', this.restaurantId])
      },
      error: (err: HttpErrorResponse) => {
        this.occupying.set(false)
        if (err.status === 409) {
          this.message.set('La mesa que elegiste se acaba de ocupar. Elige otra.')
          this.loadTables()
        } else if (err.status === 404) {
          this.message.set('La mesa que elegiste ya no existe. Elige otra.')
          this.loadTables()
        } else if (err.status === 403) {
          this.message.set('Tu cuenta no tiene permiso para ocupar mesas')
        } else {
          this.message.set('No se pudo ocupar la mesa. Inténtalo de nuevo.')
        }
      }
    })
  }

  private loadTables(): void {
    this.loadSub?.unsubscribe()
    this.loading.set(true)
    this.loadError.set(null)
    this.loadSub = this.tableService.getAvailable(this.restaurantId, this.people()).subscribe({
      next: (tables) => {
        this.tables.set(tables)
        if (!tables.some(t => t.id === this.selectedId())) {
          this.selectedId.set(null)
        }
        this.loading.set(false)
      },
      error: () => {
        this.tables.set([])
        this.selectedId.set(null)
        this.loadError.set('Error al cargar las mesas')
        this.loading.set(false)
      }
    })
  }
}
