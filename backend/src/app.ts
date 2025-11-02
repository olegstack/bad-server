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

// rate limit
app.use(
    rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 60,
        message: 'Достигнут лимит запросов, попробуйте позже',
        standardHeaders: true,
        legacyHeaders: false,
    })
)

app.use(cookieParser())

// Body parsers до статики и роутов
app.use(urlencoded({ extended: true, limit: '10kb' }))
app.use(json({ limit: '10kb' }))

// Защита от NoSQL-инъекций
app.use(mongoSanitize())

// ---------- CORS ----------
const allowlist = ['http://localhost:5173', 'http://localhost'].concat(
    ORIGIN_ALLOW ? [ORIGIN_ALLOW] : []
)

const corsOptions: CorsOptions = {
    origin(origin, cb) {
        // Разрешаем без Origin (curl/health) и whitelisted Origin
        if (!origin || allowlist.includes(origin)) return cb(null, true)
        return cb(new Error('Not allowed by CORS'))
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
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

// Гарантируем наличие заголовков (подстраховка под автотест)
app.use((req, res, next) => {
    const origin = req.headers.origin as string | undefined
    if (origin && allowlist.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin)
        res.setHeader('Access-Control-Allow-Credentials', 'true')
        res.setHeader('Access-Control-Expose-Headers', 'Set-Cookie')
        res.setHeader('Vary', 'Origin')
    }
    next()
})

// Универсальный ответ на preflight
app.options('*', (req, res) => {
    const origin = (req.headers.origin as string) || allowlist[0]
    if (origin && allowlist.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin)
        res.setHeader('Access-Control-Allow-Credentials', 'true')
    }
    res.setHeader(
        'Access-Control-Allow-Methods',
        'GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS'
    )
    res.setHeader(
        'Access-Control-Allow-Headers',
        (req.headers['access-control-request-headers'] as string) ||
            'Content-Type, Authorization, X-CSRF-Token, X-Requested-With'
    )
    res.sendStatus(204)
})
// ---------- /CORS ----------

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
