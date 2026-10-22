import { describe, it, expect, beforeEach } from 'vitest'
import { TableService } from './table.service.js'
import { normalizeTableStatus } from '@models/table.model.js'
import { MockTableRepository } from '@repositories/mocks/MockTableRepository.js'
import { MockRestaurantRepository } from '@repositories/mocks/MockRestaurantRepository.js'
import {
    InvalidTableNumberError,
    InvalidTableCapacityError,
    InvalidTableStatusError,
    InvalidPeopleCountError,
    RestaurantIdRequiredError,
    RestaurantNotFoundError,
    TableNotFoundError,
    DuplicatedTableNumberError,
    TableInUseError,
    TableNotAvailableError
} from '@errors/DomainErrors.js'

function buildRestaurant(id: string) {
    const now = new Date().toISOString()
    return {
        id,
        name: `Restaurante ${id}`,
        address: 'Calle Mayor 10',
        email: `${id}@resttek.com`,
        phone: '912345678',
        ownerFirstName: 'Carlos',
        ownerLastName: 'García',
        logoUrl: null,
        createdAt: now,
        updatedAt: now
    }
}

describe('normalizeTableStatus', () => {
    it('acepta los tres estados válidos', () => {
        for (const status of ['libre', 'ocupada', 'reservada']) {
            expect(normalizeTableStatus(status)).toBe(status)
        }
    })

    it('normaliza espacios y mayúsculas', () => {
        expect(normalizeTableStatus(' Libre ')).toBe('libre')
    })

    it('lanza InvalidTableStatusError con mensaje exacto si el estado no es válido', () => {
        expect(() => normalizeTableStatus('rota'))
            .toThrow('Invalid table status: rota. Must be one of: libre, ocupada, reservada')
    })

    it('lanza InvalidTableStatusError si falta el estado', () => {
        expect(() => normalizeTableStatus(undefined)).toThrow('Table status must be provided')
        expect(() => normalizeTableStatus('')).toThrow(InvalidTableStatusError)
    })
})

describe('TableService', () => {
    let tableRepo: MockTableRepository
    let restaurantRepo: MockRestaurantRepository
    let service: TableService

    beforeEach(async () => {
        tableRepo = new MockTableRepository()
        restaurantRepo = new MockRestaurantRepository()
        await restaurantRepo.save(buildRestaurant('r1'))
        await restaurantRepo.save(buildRestaurant('r2'))
        service = new TableService(tableRepo, restaurantRepo)
    })

    describe('create', () => {
        it('crea una mesa libre por defecto con descripción nula', async () => {
            const table = await service.create({ number: 1, capacity: 4, restaurantId: 'r1' })

            expect(table.id).toBeDefined()
            expect(table.number).toBe(1)
            expect(table.capacity).toBe(4)
            expect(table.status).toBe('libre')
            expect(table.description).toBeNull()
            expect(table.restaurantId).toBe('r1')
            expect(table.createdAt).toBe(table.updatedAt)
            expect(await tableRepo.findById(table.id)).toEqual(table)
        })

        it('recorta la descripción y normaliza el estado', async () => {
            const table = await service.create({ number: 2, description: '  Terraza  ', capacity: 6, status: 'Reservada', restaurantId: 'r1' })
            expect(table.description).toBe('Terraza')
            expect(table.status).toBe('reservada')
        })

        it('guarda null si la descripción está vacía o no es texto', async () => {
            const empty = await service.create({ number: 3, description: '   ', capacity: 2, restaurantId: 'r1' })
            const notText = await service.create({ number: 4, description: 42, capacity: 2, restaurantId: 'r1' })
            expect(empty.description).toBeNull()
            expect(notText.description).toBeNull()
        })

        it.each([0, -1, 2.5, '4', null, undefined])('rechaza el número %s', async (number) => {
            await expect(service.create({ number, capacity: 4, restaurantId: 'r1' }))
                .rejects.toThrow(InvalidTableNumberError)
        })

        it.each([0, -3, 1.5, '4', null, undefined])('rechaza la capacidad %s', async (capacity) => {
            await expect(service.create({ number: 1, capacity, restaurantId: 'r1' }))
                .rejects.toThrow(InvalidTableCapacityError)
        })

        it('rechaza un estado inválido', async () => {
            await expect(service.create({ number: 1, capacity: 4, status: 'rota', restaurantId: 'r1' }))
                .rejects.toThrow(InvalidTableStatusError)
        })

        it('exige restaurantId', async () => {
            await expect(service.create({ number: 1, capacity: 4, restaurantId: '' }))
                .rejects.toThrow(RestaurantIdRequiredError)
        })

        it('lanza RestaurantNotFoundError si el restaurante no existe', async () => {
            await expect(service.create({ number: 1, capacity: 4, restaurantId: 'r-inexistente' }))
                .rejects.toThrow(RestaurantNotFoundError)
        })

        it('rechaza un número repetido en el mismo restaurante', async () => {
            await service.create({ number: 1, capacity: 4, restaurantId: 'r1' })
            await expect(service.create({ number: 1, capacity: 2, restaurantId: 'r1' }))
                .rejects.toThrow(DuplicatedTableNumberError)
        })

        it('permite el mismo número en otro restaurante', async () => {
            await service.create({ number: 1, capacity: 4, restaurantId: 'r1' })
            const other = await service.create({ number: 1, capacity: 4, restaurantId: 'r2' })
            expect(other.restaurantId).toBe('r2')
        })
    })

    describe('update', () => {
        it('reemplaza número, descripción y capacidad y conserva el estado si no se envía', async () => {
            const created = await service.create({ number: 1, description: 'Ventana', capacity: 4, status: 'ocupada', restaurantId: 'r1' })

            const updated = await service.update('r1', created.id, { number: 9, capacity: 3 })

            expect(updated.number).toBe(9)
            expect(updated.capacity).toBe(3)
            expect(updated.description).toBeNull()
            expect(updated.status).toBe('ocupada')
            expect(updated.createdAt).toBe(created.createdAt)
            expect(updated.restaurantId).toBe('r1')
        })

        it('cambia el estado si se envía', async () => {
            const created = await service.create({ number: 1, capacity: 4, restaurantId: 'r1' })
            const updated = await service.update('r1', created.id, { number: 1, capacity: 4, status: 'reservada' })
            expect(updated.status).toBe('reservada')
        })

        it('permite reenviar el número de la propia mesa', async () => {
            const created = await service.create({ number: 1, capacity: 4, restaurantId: 'r1' })
            const updated = await service.update('r1', created.id, { number: 1, capacity: 6 })
            expect(updated.capacity).toBe(6)
        })

        it('rechaza un número usado por otra mesa del restaurante', async () => {
            await service.create({ number: 1, capacity: 4, restaurantId: 'r1' })
            const second = await service.create({ number: 2, capacity: 4, restaurantId: 'r1' })
            await expect(service.update('r1', second.id, { number: 1, capacity: 4 }))
                .rejects.toThrow(DuplicatedTableNumberError)
        })

        it('valida número, capacidad y estado', async () => {
            const created = await service.create({ number: 1, capacity: 4, restaurantId: 'r1' })
            await expect(service.update('r1', created.id, { number: 0, capacity: 4 })).rejects.toThrow(InvalidTableNumberError)
            await expect(service.update('r1', created.id, { number: 1, capacity: 0 })).rejects.toThrow(InvalidTableCapacityError)
            await expect(service.update('r1', created.id, { number: 1, capacity: 4, status: 'rota' })).rejects.toThrow(InvalidTableStatusError)
        })

        it('lanza TableNotFoundError si la mesa no existe o es de otro restaurante', async () => {
            const created = await service.create({ number: 1, capacity: 4, restaurantId: 'r1' })
            await expect(service.update('r1', 'no-existe', { number: 1, capacity: 4 })).rejects.toThrow(TableNotFoundError)
            await expect(service.update('r2', created.id, { number: 1, capacity: 4 })).rejects.toThrow(TableNotFoundError)
        })
    })

    describe('delete', () => {
        it('borra una mesa libre o reservada', async () => {
            const free = await service.create({ number: 1, capacity: 4, restaurantId: 'r1' })
            const reserved = await service.create({ number: 2, capacity: 4, status: 'reservada', restaurantId: 'r1' })

            await service.delete('r1', free.id)
            await service.delete('r1', reserved.id)

            expect(await tableRepo.findById(free.id)).toBeNull()
            expect(await tableRepo.findById(reserved.id)).toBeNull()
        })

        it('lanza TableInUseError si la mesa está ocupada', async () => {
            const busy = await service.create({ number: 1, capacity: 4, status: 'ocupada', restaurantId: 'r1' })
            await expect(service.delete('r1', busy.id)).rejects.toThrow(TableInUseError)
            expect(await tableRepo.findById(busy.id)).not.toBeNull()
        })

        it('lanza TableNotFoundError si la mesa no existe o es de otro restaurante', async () => {
            const created = await service.create({ number: 1, capacity: 4, restaurantId: 'r1' })
            await expect(service.delete('r1', 'no-existe')).rejects.toThrow(TableNotFoundError)
            await expect(service.delete('r2', created.id)).rejects.toThrow(TableNotFoundError)
        })
    })

    describe('findById y findByRestaurantId', () => {
        it('devuelve la mesa del restaurante', async () => {
            const created = await service.create({ number: 1, capacity: 4, restaurantId: 'r1' })
            expect(await service.findById('r1', created.id)).toEqual(created)
        })

        it('lanza TableNotFoundError si la mesa es de otro restaurante', async () => {
            const created = await service.create({ number: 1, capacity: 4, restaurantId: 'r1' })
            await expect(service.findById('r2', created.id)).rejects.toThrow(TableNotFoundError)
        })

        it('lista las mesas del restaurante ordenadas por número', async () => {
            await service.create({ number: 3, capacity: 4, restaurantId: 'r1' })
            await service.create({ number: 1, capacity: 4, restaurantId: 'r1' })
            await service.create({ number: 2, capacity: 4, restaurantId: 'r2' })

            const tables = await service.findByRestaurantId('r1')
            expect(tables.map(t => t.number)).toEqual([1, 3])
            expect(await service.findByRestaurantId('r-inexistente')).toEqual([])
        })
    })

    describe('changeStatus', () => {
        it('permite cualquier transición y es idempotente', async () => {
            const created = await service.create({ number: 1, capacity: 4, restaurantId: 'r1' })

            expect((await service.changeStatus('r1', created.id, 'ocupada')).status).toBe('ocupada')
            expect((await service.changeStatus('r1', created.id, 'reservada')).status).toBe('reservada')
            expect((await service.changeStatus('r1', created.id, 'libre')).status).toBe('libre')
            expect((await service.changeStatus('r1', created.id, 'libre')).status).toBe('libre')
            expect((await tableRepo.findById(created.id))?.status).toBe('libre')
        })

        it('rechaza un estado ausente o inválido', async () => {
            const created = await service.create({ number: 1, capacity: 4, restaurantId: 'r1' })
            await expect(service.changeStatus('r1', created.id, undefined)).rejects.toThrow('Table status must be provided')
            await expect(service.changeStatus('r1', created.id, 'rota')).rejects.toThrow(InvalidTableStatusError)
        })

        it('lanza TableNotFoundError si la mesa no existe', async () => {
            await expect(service.changeStatus('r1', 'no-existe', 'libre')).rejects.toThrow(TableNotFoundError)
        })
    })

    describe('occupy', () => {
        it('ocupa una mesa libre y devuelve la mesa actualizada', async () => {
            const created = await service.create({ number: 1, capacity: 4, restaurantId: 'r1' })
            const occupied = await service.occupy('r1', created.id)
            expect(occupied.status).toBe('ocupada')
            expect((await tableRepo.findById(created.id))?.status).toBe('ocupada')
        })

        it('lanza TableNotAvailableError si ya está ocupada (segunda ocupación)', async () => {
            const created = await service.create({ number: 1, capacity: 4, restaurantId: 'r1' })
            await service.occupy('r1', created.id)
            await expect(service.occupy('r1', created.id)).rejects.toThrow(TableNotAvailableError)
        })

        it('lanza TableNotAvailableError si está reservada', async () => {
            const created = await service.create({ number: 1, capacity: 4, status: 'reservada', restaurantId: 'r1' })
            await expect(service.occupy('r1', created.id)).rejects.toThrow(TableNotAvailableError)
        })

        it('solo uno de dos intentos simultáneos consigue la mesa', async () => {
            const created = await service.create({ number: 1, capacity: 4, restaurantId: 'r1' })
            const results = await Promise.allSettled([service.occupy('r1', created.id), service.occupy('r1', created.id)])
            expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1)
            expect(results.filter(r => r.status === 'rejected')).toHaveLength(1)
        })

        it('lanza TableNotFoundError si la mesa no existe o es de otro restaurante', async () => {
            const created = await service.create({ number: 1, capacity: 4, restaurantId: 'r1' })
            await expect(service.occupy('r1', 'no-existe')).rejects.toThrow(TableNotFoundError)
            await expect(service.occupy('r2', created.id)).rejects.toThrow(TableNotFoundError)
        })
    })

    describe('findAvailable', () => {
        beforeEach(async () => {
            await service.create({ number: 1, capacity: 2, restaurantId: 'r1' })
            await service.create({ number: 4, capacity: 4, restaurantId: 'r1' })
            await service.create({ number: 3, capacity: 4, restaurantId: 'r1' })
            await service.create({ number: 5, capacity: 6, status: 'ocupada', restaurantId: 'r1' })
            await service.create({ number: 6, capacity: 8, status: 'reservada', restaurantId: 'r1' })
            await service.create({ number: 7, capacity: 8, restaurantId: 'r1' })
            await service.create({ number: 1, capacity: 10, restaurantId: 'r2' })
        })

        it('filtra por estado libre y capacidad, y ordena por capacidad y número', async () => {
            const tables = await service.findAvailable('r1', '3')
            expect(tables.map(t => t.number)).toEqual([3, 4, 7])
        })

        it('devuelve [] si ninguna mesa encaja o el restaurante no existe', async () => {
            expect(await service.findAvailable('r1', '9')).toEqual([])
            expect(await service.findAvailable('r-inexistente', '2')).toEqual([])
        })

        it.each([undefined, '', '0', '-1', '2.5', 'abc', ['2', '3']])('rechaza people = %s', async (people) => {
            await expect(service.findAvailable('r1', people)).rejects.toThrow(InvalidPeopleCountError)
        })
    })
})
