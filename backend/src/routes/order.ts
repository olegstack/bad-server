import { Router } from 'express'
import {
    createOrder,
    deleteOrder,
    getOrderByNumber,
    getOrderCurrentUserByNumber,
    getOrders,
    getOrdersCurrentUser,
    updateOrder,
} from '../controllers/order'
import auth, { roleGuardMiddleware } from '../middlewares/auth'
import { validateOrderBody } from '../middlewares/validations'
import { Role } from '../models/user'
import { doubleCsrfProtection } from '../middlewares/csrf'

const orderRouter = Router()

// Создать заказ (пользователь)
orderRouter.post('/', auth, validateOrderBody, createOrder)

// Админский список
orderRouter.get('/', auth, roleGuardMiddleware(Role.Admin), getOrders)

orderRouter.get('/all', auth, roleGuardMiddleware(Role.Admin), getOrders)
orderRouter.get('/all/me', auth, getOrdersCurrentUser)

// Мои заказы
orderRouter.get('/me', auth, getOrdersCurrentUser)

// Заказ по номеру (админ)
orderRouter.get(
    '/:orderNumber',
    auth,
    roleGuardMiddleware(Role.Admin),
    getOrderByNumber
)

// Мой конкретный заказ по номеру
orderRouter.get('/me/:orderNumber', auth, getOrderCurrentUserByNumber)

// Обновить статус (админ)
orderRouter.patch(
    '/:orderNumber',
    auth,
    roleGuardMiddleware(Role.Admin),
    updateOrder
)

// Удалить заказ (админ, с CSRF)
orderRouter.delete(
    '/:id',
    doubleCsrfProtection,
    auth,
    roleGuardMiddleware(Role.Admin),
    deleteOrder
)

export default orderRouter
