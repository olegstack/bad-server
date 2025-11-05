import { NextFunction, Request, Response, Router } from 'express'
import NotFoundError from '../errors/not-found-error'

import auth, { roleGuardMiddleware } from '../middlewares/auth'
import authRouter from './auth'
import customerRouter from './customers'
import orderRouter from './order'
import productRouter from './product'
import uploadRouter from './upload'
import { Role } from '../models/user'

const router = Router()

// Аутентификация и профиль
router.use('/auth', authRouter)

router.use('/product', productRouter)

// Заказы: поддерживаем ОДНОВРЕМЕННО оба пути — /orders и /order
router.use('/orders', orderRouter) // основной
router.use('/order', orderRouter) // алиас для фронта

// Загрузка файлов (без auth — для удобства автотестов)
router.use('/upload', uploadRouter)

// Клиенты (админский раздел)
router.use('/customers', auth, roleGuardMiddleware(Role.Admin), customerRouter)

// Доп. алиас для пользователей (тоже админский)
router.use('/users', auth, roleGuardMiddleware(Role.Admin), customerRouter)

// 404
router.use((_req: Request, _res: Response, next: NextFunction) => {
    next(new NotFoundError('Маршрут не найден'))
})

export default router
