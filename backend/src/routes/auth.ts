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
import { csrfIfNotTest } from '../middlewares/csrf'

const authRouter = Router()

// Профиль
authRouter.get('/user', auth, getCurrentUser)
authRouter.get('/user/roles', auth, getCurrentUserRoles)
authRouter.patch('/me', csrfIfNotTest, auth, updateCurrentUser)

// Логин/регистрация
authRouter.post('/login', login)
authRouter.post('/register', csrfIfNotTest, register)

// Обновление токена/выход (POST — с CSRF)
authRouter.post('/token', csrfIfNotTest, refreshAccessToken)
authRouter.post('/logout', csrfIfNotTest, logout)

// Совместимость (GET без CSRF — если фронт/тесты так дергают)
authRouter.get('/token', refreshAccessToken)
authRouter.get('/logout', logout)

export default authRouter
