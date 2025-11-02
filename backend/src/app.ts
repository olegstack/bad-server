import { errors } from 'celebrate'
import cookieParser from 'cookie-parser'
import cors, { CorsOptions } from 'cors'
import 'dotenv/config'
import express, { json, urlencoded } from 'express'
import mongoose from 'mongoose'
import path from 'path'
import mongoSanitize from 'express-mongo-sanitize'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'

import { DB_ADDRESS, ORIGIN_ALLOW, PORT } from './config'
import errorHandler from './middlewares/error-handler'
import serveStatic from './middlewares/serverStatic'
import routes from './routes'

const app = express()
app.set('trust proxy', 1)

// security headers
app.use(
    helmet({
        crossOriginResourcePolicy: { policy: 'cross-origin' },
    })
)

// health
app.get('/__ping', (_req, res) => res.type('text').send('pong'))

// rate limit — включаем везде, кроме тестов/CI (чтобы Actions не споткнулся)
if (process.env.NODE_ENV !== 'test' && process.env.CI !== 'true') {
    app.use(
        rateLimit({
            windowMs: 15 * 60 * 1000,
            max: 60,
            message: 'Достигнут лимит запросов, попробуйте позже',
            standardHeaders: true,
            legacyHeaders: false,
        })
    )
}

app.use(cookieParser())

// Body parsers до статики и роутов
app.use(urlencoded({ extended: true, limit: '10kb' }))
app.use(json({ limit: '10kb' }))

// Защита от NoSQL-инъекций
app.use(mongoSanitize())

// CORS (единые опции и для preflight)
const whitelist = [
    ORIGIN_ALLOW,
    'http://localhost',
    'http://localhost:5173',
].filter(Boolean)

const corsOptions: CorsOptions = {
    origin(origin, cb) {
        if (!origin || whitelist.includes(origin)) return cb(null, true)
        return cb(new Error('Not allowed by CORS'))
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-CSRF-Token',
        'x-csrf-token',
        'X-Requested-With',
    ],
    exposedHeaders: ['Set-Cookie'],
    optionsSuccessStatus: 204,
}

app.use(cors(corsOptions))
app.options('*', cors(corsOptions))

// Статика
app.use(serveStatic(path.join(__dirname, 'public')))

// Роуты и обработчики
app.use(routes)
app.use(errors())
app.use(errorHandler)

const bootstrap = async () => {
    try {
        await mongoose.connect(DB_ADDRESS)
        await app.listen(PORT, () => console.log('ok'))
    } catch (error) {
        console.error(error)
    }
}

bootstrap()
