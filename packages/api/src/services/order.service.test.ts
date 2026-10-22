import { describe, it, expect, beforeEach } from 'vitest'
import { OrderService } from './order.service.js'
import { MockOrderRepository } from '@repositories/mocks/MockOrderRepository.js'
import { MockTableRepository } from '@repositories/mocks/MockTableRepository.js'
import type { Order } from '@models/order.model.js'
import type { Table } from '@models/table.model.js'
import { OrderNotFoundError, InvalidOrderStatusError, RestaurantIdRequiredError, TableNotFoundError, TableNotOccupiedError } from '@errors/DomainErrors.js'

describe('OrderService.updateItemStatus', () => {
    let repo: MockOrderRepository
    let service: OrderService
    let testOrder: Order

    beforeEach(async () => {
        repo = new MockOrderRepository()
        service = new OrderService(repo, new MockTableRepository())

        testOrder = {
            id: 'order-1',
            restaurantId: 'rest-1',
            tableId: null,
            tableNumber: null,
            clientId: null,
            createdAt: new Date(),
            items: [
                { id: 'item-1', dishId: 'dish-1', quantity: 1, notes: null, status: 'pendiente' }
            ]
        }
        await repo.create(testOrder)
    })

    it('should update the status of an item successfully', async () => {
        await service.updateItemStatus('order-1', 'item-1', 'preparando')
        const updatedItem = testOrder.items[0]!
        expect(updatedItem.status).toBe('preparando')
    })

    it('should throw an error if the order does not exist', async () => {
        await expect(service.updateItemStatus('order-bad', 'item-1', 'preparando'))
            .rejects.toThrow(OrderNotFoundError)
    })

    it('should throw an error if the item does not exist inside the order', async () => {
        await expect(service.updateItemStatus('order-1', 'item-bad', 'preparando'))
            .rejects.toThrow(OrderNotFoundError)
    })

    it('should throw DomainError if status is invalid', async () => {
        await expect(service.updateItemStatus('order-1', 'item-1', 'invalid-status'))
            .rejects.toThrow(InvalidOrderStatusError)
    })
})

describe('OrderService.create con mesa', () => {
    let orderRepo: MockOrderRepository
    let tableRepo: MockTableRepository
    let service: OrderService

    const items = [{ dishId: 'dish-1', quantity: 2, notes: null }]

    function buildTable(overrides: Partial<Table>): Table {
        const now = new Date().toISOString()
        return {
            id: 'table-1',
            number: 5,
            description: null,
            capacity: 4,
            status: 'ocupada',
            restaurantId: 'rest-1',
            createdAt: now,
            updatedAt: now,
            ...overrides
        }
    }

    beforeEach(async () => {
        orderRepo = new MockOrderRepository()
        tableRepo = new MockTableRepository()
        service = new OrderService(orderRepo, tableRepo)

        await tableRepo.save(buildTable({ id: 'table-ocupada', number: 5, status: 'ocupada' }))
        await tableRepo.save(buildTable({ id: 'table-libre', number: 1, status: 'libre' }))
        await tableRepo.save(buildTable({ id: 'table-reservada', number: 2, status: 'reservada' }))
        await tableRepo.save(buildTable({ id: 'table-otro', number: 5, status: 'ocupada', restaurantId: 'rest-2' }))
    })

    it('crea el pedido con la mesa ocupada y devuelve su número', async () => {
        const order = await service.create({ restaurantId: 'rest-1', tableId: 'table-ocupada', clientId: 'c1', items })

        expect(order.tableId).toBe('table-ocupada')
        expect(order.tableNumber).toBe(5)
        expect(order.items).toHaveLength(2)
        expect(orderRepo.orders).toHaveLength(1)
    })

    it('sin mesa (tableId null) sigue funcionando y tableNumber es null', async () => {
        const order = await service.create({ restaurantId: 'rest-1', tableId: null, clientId: 'c1', items })

        expect(order.tableId).toBeNull()
        expect(order.tableNumber).toBeNull()
        expect(orderRepo.orders).toHaveLength(1)
    })

    it('trata tableId vacío como pedido sin mesa', async () => {
        const order = await service.create({ restaurantId: 'rest-1', tableId: '', clientId: 'c1', items })
        expect(order.tableId).toBeNull()
        expect(order.tableNumber).toBeNull()
    })

    it('lanza TableNotFoundError (Table not found) si la mesa no existe', async () => {
        await expect(service.create({ restaurantId: 'rest-1', tableId: 'no-existe', clientId: 'c1', items }))
            .rejects.toThrow(TableNotFoundError)
        await expect(service.create({ restaurantId: 'rest-1', tableId: 'no-existe', clientId: 'c1', items }))
            .rejects.toThrow('Table not found')
        expect(orderRepo.orders).toHaveLength(0)
    })

    it('lanza TableNotFoundError si la mesa es de otro restaurante', async () => {
        await expect(service.create({ restaurantId: 'rest-1', tableId: 'table-otro', clientId: 'c1', items }))
            .rejects.toThrow(TableNotFoundError)
        expect(orderRepo.orders).toHaveLength(0)
    })

    it('lanza TableNotOccupiedError (Table is not occupied) si la mesa está libre o reservada', async () => {
        await expect(service.create({ restaurantId: 'rest-1', tableId: 'table-libre', clientId: 'c1', items }))
            .rejects.toThrow('Table is not occupied')
        await expect(service.create({ restaurantId: 'rest-1', tableId: 'table-reservada', clientId: 'c1', items }))
            .rejects.toThrow(TableNotOccupiedError)
        expect(orderRepo.orders).toHaveLength(0)
    })

    it('comprueba restaurantId antes que la mesa', async () => {
        await expect(service.create({ restaurantId: '', tableId: 'no-existe', clientId: 'c1', items }))
            .rejects.toThrow(RestaurantIdRequiredError)
    })
})
