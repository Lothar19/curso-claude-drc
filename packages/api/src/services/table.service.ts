import { randomUUID } from 'crypto'
import type { Table, TableStatusType } from '@models/table.model.js'
import { normalizeTableStatus } from '@models/table.model.js'
import type { TableRepository } from '@repositories/table.repository.js'
import type { RestaurantRepository } from '@repositories/restaurant.repository.js'
import {
    InvalidTableNumberError,
    InvalidTableCapacityError,
    InvalidPeopleCountError,
    RestaurantIdRequiredError,
    RestaurantNotFoundError,
    TableNotFoundError,
    DuplicatedTableNumberError,
    TableInUseError,
    TableNotAvailableError
} from '@errors/DomainErrors.js'

/**
 * Los campos llegan tal cual del body (`unknown`): el servicio es quien valida tipos y valores.
 */
export interface CreateTableDTO {
    number: unknown
    description?: unknown
    capacity: unknown
    status?: unknown
    restaurantId: string
}

/** Reemplazo completo de número, descripción y capacidad; `status` ausente conserva el actual. */
export interface UpdateTableDTO {
    number: unknown
    description?: unknown
    capacity: unknown
    status?: unknown
}

const PEOPLE_REGEX = /^[0-9]+$/

function isPositiveInteger(value: unknown): value is number {
    return typeof value === 'number' && Number.isInteger(value) && value > 0
}

function normalizeDescription(value: unknown): string | null {
    if (typeof value !== 'string') return null
    const trimmed = value.trim()
    return trimmed === '' ? null : trimmed
}

function isMissing(value: unknown): boolean {
    return value === undefined || value === null
}

export class TableService {
    constructor(
        private readonly tableRepository: TableRepository,
        private readonly restaurantRepository: RestaurantRepository
    ) {}

    async create(dto: CreateTableDTO): Promise<Table> {
        if (!dto.restaurantId || dto.restaurantId.trim() === '') {
            throw new RestaurantIdRequiredError()
        }

        const now = new Date().toISOString()
        const table = this.buildTable({
            id: randomUUID(),
            number: dto.number,
            description: dto.description,
            capacity: dto.capacity,
            status: isMissing(dto.status) ? 'libre' : normalizeTableStatus(dto.status),
            restaurantId: dto.restaurantId,
            createdAt: now,
            updatedAt: now
        })

        const restaurant = await this.restaurantRepository.findById(dto.restaurantId)
        if (!restaurant) {
            throw new RestaurantNotFoundError()
        }

        await this.ensureNumberIsFree(table)
        await this.tableRepository.save(table)
        return table
    }

    async update(restaurantId: string, id: string, dto: UpdateTableDTO): Promise<Table> {
        const existing = await this.findById(restaurantId, id)

        const updated = this.buildTable({
            id: existing.id,
            number: dto.number,
            description: dto.description,
            capacity: dto.capacity,
            status: isMissing(dto.status) ? existing.status : normalizeTableStatus(dto.status),
            restaurantId: existing.restaurantId,
            createdAt: existing.createdAt,
            updatedAt: new Date().toISOString()
        })

        await this.ensureNumberIsFree(updated)
        await this.tableRepository.save(updated)
        return updated
    }

    async delete(restaurantId: string, id: string): Promise<void> {
        const existing = await this.findById(restaurantId, id)
        if (existing.status === 'ocupada') {
            throw new TableInUseError()
        }
        await this.tableRepository.delete(id)
    }

    /** Devuelve la mesa si existe y pertenece al restaurante; si no, `TableNotFoundError`. */
    async findById(restaurantId: string, id: string): Promise<Table> {
        const table = await this.tableRepository.findById(id)
        if (!table || table.restaurantId !== restaurantId) {
            throw new TableNotFoundError()
        }
        return table
    }

    async findByRestaurantId(restaurantId: string): Promise<Table[]> {
        return this.tableRepository.findByRestaurantId(restaurantId)
    }

    /** `people` llega como texto de la query string: debe ser un entero decimal >= 1. */
    async findAvailable(restaurantId: string, people: unknown): Promise<Table[]> {
        if (typeof people !== 'string' || !PEOPLE_REGEX.test(people) || Number(people) < 1) {
            throw new InvalidPeopleCountError()
        }
        return this.tableRepository.findAvailable(restaurantId, Number(people))
    }

    async changeStatus(restaurantId: string, id: string, status: unknown): Promise<Table> {
        const existing = await this.findById(restaurantId, id)
        const updated: Table = {
            ...existing,
            status: normalizeTableStatus(status),
            updatedAt: new Date().toISOString()
        }
        await this.tableRepository.save(updated)
        return updated
    }

    /** Ocupa una mesa libre de forma atómica; si ya no está libre, `TableNotAvailableError`. */
    async occupy(restaurantId: string, id: string): Promise<Table> {
        await this.findById(restaurantId, id)

        const occupied = await this.tableRepository.occupyIfFree(id, new Date().toISOString())
        if (!occupied) {
            throw new TableNotAvailableError()
        }

        return this.findById(restaurantId, id)
    }

    private async ensureNumberIsFree(table: Table): Promise<void> {
        const sameNumber = await this.tableRepository.findByNumber(table.restaurantId, table.number)
        if (sameNumber && sameNumber.id !== table.id) {
            throw new DuplicatedTableNumberError()
        }
    }

    private buildTable(props: {
        id: string
        number: unknown
        description: unknown
        capacity: unknown
        status: TableStatusType
        restaurantId: string
        createdAt: string
        updatedAt: string
    }): Table {
        if (!isPositiveInteger(props.number)) {
            throw new InvalidTableNumberError()
        }
        if (!isPositiveInteger(props.capacity)) {
            throw new InvalidTableCapacityError()
        }

        return {
            id: props.id,
            number: props.number,
            description: normalizeDescription(props.description),
            capacity: props.capacity,
            status: props.status,
            restaurantId: props.restaurantId,
            createdAt: props.createdAt,
            updatedAt: props.updatedAt
        }
    }
}
