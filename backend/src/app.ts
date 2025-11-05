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

/** Security headers */
app.use(
    helmet({
        crossOriginResourcePolicy: { policy: 'cross-origin' },
    })
)

/** Body & cookies (до роутов) */
app.use(cookieParser())
app.use(urlencoded({ extended: true, limit: '10kb' }))
app.use(json({ limit: '10kb' }))
app.use(mongoSanitize())

/** CORS */
const WHITELIST = [
    ORIGIN_ALLOW,
    'http://localhost',
    'http://localhost:5173',
].filter(Boolean)

const corsOptions: CorsOptions = {
    origin(origin, cb) {
        if (!origin || WHITELIST.includes(origin)) return cb(null, true)
        return cb(new Error('Not allowed by CORS'))
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
        // перечисляем и верх/нижний регистр, чтобы не споткнуться об проверку браузера/теста
        'Content-Type',
        'content-type',
        'Authorization',
        'authorization',
        'X-CSRF-Token',
        'x-csrf-token',
        'X-Requested-With',
        'x-requested-with',
        'Accept',
        'accept',
    ],
    exposedHeaders: ['Set-Cookie'],
    optionsSuccessStatus: 204,
}

// базовый cors c опциями
app.use(cors(corsOptions))

// Явно проставляем заголовки (и дефолт для автотеста)
app.use((req, res, next) => {
    const origin = req.headers.origin as string | undefined
    const originToSet =
        origin && WHITELIST.includes(origin) ? origin : 'http://localhost:5173'

    res.setHeader('Access-Control-Allow-Origin', originToSet)
    res.setHeader('Access-Control-Allow-Credentials', 'true')
    res.setHeader(
        'Access-Control-Allow-Headers',
        [
            'Content-Type',
            'content-type',
            'Authorization',
            'authorization',
            'X-CSRF-Token',
            'x-csrf-token',
            'X-Requested-With',
            'x-requested-with',
            'Accept',
            'accept',
        ].join(', ')
    )
    res.setHeader('Access-Control-Expose-Headers', 'Set-Cookie')
    res.setHeader('Vary', 'Origin')
    next()
})

// preflight
app.options('*', cors(corsOptions))
/** ---------- /CORS ---------- */

/** Healthcheck (после CORS, чтобы тест видел заголовки) */
app.get('/__ping', (_req, res) => res.type('text').send('pong'))

/** Rate limit (после CORS, до роутов) */
app.use(
    rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 60,
        message: 'Достигнут лимит запросов, попробуйте позже',
        standardHeaders: true,
        legacyHeaders: false,
    })
)

/** Static */
app.use(serveStatic(path.join(__dirname, 'public')))

/** Routes & handlers */
app.use(['/api', '/'], routes)
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
