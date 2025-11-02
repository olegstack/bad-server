import { Router } from 'express'
import {
    deleteCustomer,
    getCustomerById,
    getCustomers,
    updateCustomer,
} from '../controllers/customers'
import auth, { roleGuardMiddleware } from '../middlewares/auth'
import { Role } from '../models/user'
import { csrfIfNotTest } from '../middlewares/csrf'

// Этот роутер монтируется уже ПОВЕРХ admin-гардов в index.ts,
// но оставим защиту на всякий случай для прямого подключения.
const customerRouter = Router()

// Только GET — без CSRF
customerRouter.get('/', auth, roleGuardMiddleware(Role.Admin), getCustomers)
customerRouter.get(
    '/:id',
    auth,
    roleGuardMiddleware(Role.Admin),
    getCustomerById
)

// Изменяющие — с CSRF
customerRouter.patch(
    '/:id',
    csrfIfNotTest,
    auth,
    roleGuardMiddleware(Role.Admin),
    updateCustomer
)

customerRouter.delete(
    '/:id',
    csrfIfNotTest,
    auth,
    roleGuardMiddleware(Role.Admin),
    deleteCustomer
)

export default customerRouter
