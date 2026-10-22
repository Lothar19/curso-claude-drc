import { Router } from 'express'
import { TableController } from '@controllers/table.controller.js'
import { dbConfig } from '@config/database.js'
import { SqliteTableRepository } from '@repositories/table.repository.js'
import { SqliteRestaurantRepository } from '@repositories/restaurant.repository.js'
import { TableService } from '@services/table.service.js'
import { authenticate, authorize } from '@shared/infrastructure/http/middlewares.js'

const tableRepository = new SqliteTableRepository(dbConfig)
const restaurantRepository = new SqliteRestaurantRepository(dbConfig)
const tableService = new TableService(tableRepository, restaurantRepository)
const tableController = new TableController(tableService)

const router = Router({ mergeParams: true })

router.post('/', authenticate, authorize(['admin']), tableController.create)
router.get('/', authenticate, authorize(['admin', 'manager', 'camarero']), tableController.getAll)
// Debe ir antes de '/:id' para que 'available' no se interprete como un id
router.get('/available', authenticate, tableController.getAvailable)
router.get('/:id', authenticate, authorize(['admin', 'manager', 'camarero']), tableController.getById)
router.put('/:id', authenticate, authorize(['admin']), tableController.update)
router.delete('/:id', authenticate, authorize(['admin']), tableController.delete)
router.patch('/:id/status', authenticate, authorize(['admin', 'manager', 'camarero']), tableController.changeStatus)
router.post('/:id/occupy', authenticate, authorize(['cliente']), tableController.occupy)

export default router
