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

const customerRouter = Router()

customerRouter.get('/', auth, roleGuardMiddleware(Role.Admin), getCustomers)
customerRouter.get(
    '/:id',
    auth,
    roleGuardMiddleware(Role.Admin),
    getCustomerById
)
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
