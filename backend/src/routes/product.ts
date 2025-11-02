import { Router } from 'express'
import {
    createProduct,
    deleteProduct,
    getProducts,
    updateProduct,
} from '../controllers/products'
import auth, { roleGuardMiddleware } from '../middlewares/auth'
import {
    validateObjId,
    validateProductBody,
    validateProductUpdateBody,
} from '../middlewares/validations'
import { Role } from '../models/user'
import { csrfIfNotTest } from '../middlewares/csrf'

// Путь оставляем /product (как у тебя было)
const productRouter = Router()

// Список — без auth
productRouter.get('/', getProducts)

// Создать/обновить/удалить — админ + CSRF на мутациях
productRouter.post(
    '/',
    csrfIfNotTest,
    auth,
    roleGuardMiddleware(Role.Admin),
    validateProductBody,
    createProduct
)

productRouter.patch(
    '/:productId',
    csrfIfNotTest,
    auth,
    roleGuardMiddleware(Role.Admin),
    validateObjId,
    validateProductUpdateBody,
    updateProduct
)

productRouter.delete(
    '/:productId',
    csrfIfNotTest,
    auth,
    roleGuardMiddleware(Role.Admin),
    validateObjId,
    deleteProduct
)

export default productRouter
