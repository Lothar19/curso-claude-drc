import { Component, inject, OnInit, signal } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { ActivatedRoute, Router, RouterLink } from '@angular/router'
import { LucideAngularModule } from 'lucide-angular'
import { firstValueFrom } from 'rxjs'
import { TableStore } from '../../store/table.store'
import { TableService } from '../../services/table.service'
import { getTableErrorMessage } from '../../helpers/table-error.helper'
import type { TableStatus } from '../../models/table.model'

interface TableFormValue {
  number: number | null
  description: string
  capacity: number | null
  status: TableStatus
}

@Component({
  selector: 'app-table-form',
  standalone: true,
  imports: [FormsModule, RouterLink, LucideAngularModule],
  templateUrl: './table-form.component.html',
  styleUrl: './table-form.component.css'
})
export class TableFormComponent implements OnInit {
  private readonly store = inject(TableStore)
  private readonly service = inject(TableService)
  private readonly route = inject(ActivatedRoute)
  private readonly router = inject(Router)

  isEditing = false
  tableId: string | null = null
  restaurantId: string = ''
  loading = signal(false)
  error = signal<string | null>(null)

  statuses: TableStatus[] = ['libre', 'ocupada', 'reservada']

  form: TableFormValue = {
    number: null,
    description: '',
    capacity: null,
    status: 'libre'
  }

  get pageTitle(): string {
    return this.isEditing ? 'Editar mesa' : 'Nueva mesa'
  }

  get listUrl(): string {
    return `/restaurants/${this.restaurantId}/tables`
  }

  ngOnInit(): void {
    this.restaurantId = this.route.parent?.snapshot.params['restaurantId'] ?? ''
    const id = this.route.snapshot.paramMap.get('id')

    if (id && this.restaurantId) {
      this.isEditing = true
      this.tableId = id
      this.loadTable()
    }
  }

  private async loadTable(): Promise<void> {
    this.loading.set(true)
    try {
      const tables = await firstValueFrom(this.service.getAll(this.restaurantId))
      const found = tables.find(t => t.id === this.tableId)
      if (found) {
        this.form = {
          number: found.number,
          description: found.description ?? '',
          capacity: found.capacity,
          status: found.status
        }
      } else {
        this.error.set('La mesa no existe o ya fue eliminada.')
      }
    } catch (err) {
      this.error.set(getTableErrorMessage(err, 'No se pudo cargar la mesa.'))
    } finally {
      this.loading.set(false)
    }
  }

  async onSubmit(): Promise<void> {
    this.error.set(null)

    const number = Number(this.form.number)
    const capacity = Number(this.form.capacity)
    if (!Number.isInteger(number) || number < 1) {
      this.error.set('El número de mesa debe ser un entero mayor que 0.')
      return
    }
    if (!Number.isInteger(capacity) || capacity < 1) {
      this.error.set('La capacidad debe ser un entero mayor que 0.')
      return
    }

    const description = this.form.description.trim() || null

    this.loading.set(true)
    try {
      if (this.isEditing && this.tableId) {
        await this.store.update(this.restaurantId, this.tableId, {
          number,
          description,
          capacity,
          status: this.form.status
        })
      } else {
        await this.store.create(this.restaurantId, {
          number,
          description,
          capacity,
          status: this.form.status
        })
      }
      this.router.navigate(['/restaurants', this.restaurantId, 'tables'])
    } catch (err) {
      this.error.set(getTableErrorMessage(err, 'Error al guardar la mesa.'))
    } finally {
      this.loading.set(false)
    }
  }
}
