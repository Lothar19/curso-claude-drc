import { SqliteTableRepository } from './table.repository.js'
import { Database } from '@config/database.js'
import type { Table } from '@models/table.model.js'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'

function buildTable(overrides: Partial<Table>): Table {
    const now = new Date().toISOString()
    return {
        id: 't1',
        number: 1,
        description: null,
        capacity: 4,
        status: 'libre',
        restaurantId: 'r1',
        createdAt: now,
        updatedAt: now,
        ...overrides
    }
}

describe('SqliteTableRepository (Integration)', () => {
    let db: Database
    let repo: SqliteTableRepository

    beforeAll(async () => {
        process.env.NODE_ENV = 'test'
        db = new Database()
        await db.initialize()
        repo = new SqliteTableRepository(db)

        for (const id of ['r1', 'r2']) {
            await db.run(
                'INSERT INTO restaurants (id, name, address, email, phone, owner_first_name, owner_last_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [id, `Restaurante ${id}`, 'Calle Mayor 10', `${id}@resttek.com`, '+34 612345678', 'Carlos', 'García', new Date().toISOString(), new Date().toISOString()]
            )
        }
    })

    afterAll(async () => {
        await db.close()
    })

    it('guarda y encuentra una mesa por id', async () => {
        await repo.save(buildTable({ id: 't1', number: 1, description: 'Ventana', capacity: 2 }))

        const found = await repo.findById('t1')
        expect(found).not.toBeNull()
        expect(found?.number).toBe(1)
        expect(found?.description).toBe('Ventana')
        expect(found?.capacity).toBe(2)
        expect(found?.status).toBe('libre')
        expect(found?.restaurantId).toBe('r1')
    })

    it('devuelve null si la mesa no existe', async () => {
        expect(await repo.findById('no-existe')).toBeNull()
    })

    it('actualiza una mesa existente', async () => {
        await repo.save(buildTable({ id: 't1', number: 1, description: null, capacity: 3, status: 'reservada' }))

        const found = await repo.findById('t1')
        expect(found?.capacity).toBe(3)
        expect(found?.description).toBeNull()
        expect(found?.status).toBe('reservada')
    })

    it('impone UNIQUE(restaurant_id, number) y permite el mismo número en otro restaurante', async () => {
        await expect(repo.save(buildTable({ id: 't-dup', number: 1 }))).rejects.toThrow(/UNIQUE/)
        await repo.save(buildTable({ id: 't-r2', number: 1, restaurantId: 'r2' }))
        expect(await repo.findByNumber('r2', 1)).not.toBeNull()
    })

    it('busca por número dentro del restaurante', async () => {
        expect((await repo.findByNumber('r1', 1))?.id).toBe('t1')
        expect(await repo.findByNumber('r1', 99)).toBeNull()
    })

    it('lista las mesas de un restaurante ordenadas por número', async () => {
        await repo.save(buildTable({ id: 't3', number: 3, capacity: 4 }))
        await repo.save(buildTable({ id: 't2', number: 2, capacity: 4 }))

        const tables = await repo.findByRestaurantId('r1')
        expect(tables.map(t => t.number)).toEqual([1, 2, 3])
    })

    it('findAvailable filtra libres con capacidad suficiente y ordena por capacidad y número', async () => {
        await repo.save(buildTable({ id: 't4', number: 4, capacity: 2 }))
        await repo.save(buildTable({ id: 't5', number: 5, capacity: 8, status: 'ocupada' }))
        await repo.save(buildTable({ id: 't6', number: 6, capacity: 6 }))

        const tables = await repo.findAvailable('r1', 3)
        expect(tables.map(t => t.number)).toEqual([2, 3, 6])
        expect(await repo.findAvailable('r1', 50)).toEqual([])
    })

    it('occupyIfFree ocupa una mesa libre una sola vez', async () => {
        expect(await repo.occupyIfFree('t2', '2026-10-22T12:00:00.000Z')).toBe(true)
        const found = await repo.findById('t2')
        expect(found?.status).toBe('ocupada')
        expect(found?.updatedAt).toBe('2026-10-22T12:00:00.000Z')

        expect(await repo.occupyIfFree('t2', '2026-10-22T12:00:01.000Z')).toBe(false)
    })

    it('occupyIfFree devuelve false si la mesa no existe o no está libre', async () => {
        expect(await repo.occupyIfFree('no-existe', new Date().toISOString())).toBe(false)
        expect(await repo.occupyIfFree('t1', new Date().toISOString())).toBe(false)
    })

    it('borra una mesa', async () => {
        await repo.delete('t3')
        expect(await repo.findById('t3')).toBeNull()
    })
})
