import { Router } from 'express'
import {
    getCurrentUser,
    getCurrentUserRoles,
    login,
    logout,
    refreshAccessToken,
    register,
    updateCurrentUser,
} from '../controllers/auth'
import auth from '../middlewares/auth'

const authRouter = Router()

// Профиль
authRouter.get('/user', auth, getCurrentUser)
authRouter.get('/user/roles', auth, getCurrentUserRoles)
authRouter.patch('/me', auth, updateCurrentUser)

// Логин/регистрация
authRouter.post('/login', login)
authRouter.post('/register', register)

// Обновление токена/выход (POST — с CSRF)
authRouter.post('/token', refreshAccessToken)
authRouter.post('/logout',logout)

// Совместимость (GET без CSRF — если фронт/тесты так дергают)
authRouter.get('/token', refreshAccessToken)
authRouter.get('/logout', logout)

export default authRouter
