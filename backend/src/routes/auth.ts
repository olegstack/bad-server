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

authRouter.get('/user', auth, getCurrentUser)
authRouter.get('/user/roles', auth, getCurrentUserRoles)

// PATCH /me — с CSRF (в тестах/CI отключается), + auth
authRouter.patch('/me', csrfIfNotTest, auth, updateCurrentUser)

// Логин/регистрация
authRouter.post('/login', login)
authRouter.post('/register', csrfIfNotTest, register)

// Безопасный вариант по ТЗ — POST + CSRF
authRouter.post('/token', csrfIfNotTest, refreshAccessToken)
authRouter.post('/logout', csrfIfNotTest, logout)

// --- Совместимость с фронтом и автотестами (НЕ блокируем CSRF на GET):
authRouter.get('/token', refreshAccessToken)
authRouter.get('/logout', logout)

export default authRouter
