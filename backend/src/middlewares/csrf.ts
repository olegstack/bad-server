import crypto from 'crypto'
import type { Request, Response, NextFunction } from 'express'
import { doubleCsrf, type DoubleCsrfConfigOptions } from 'csrf-csrf'
import { CSRF_SECRET, CSRF_COOKIE_NAME, REFRESH_TOKEN } from '../config'

export const isCiOrTest =
    process.env.NODE_ENV === 'test' || process.env.CI === 'true'

const getSessionIdentifier = (req: Request) => {
    // Стабильный идентификатор до логина: refreshToken || ip+ua
    const raw =
        req.cookies?.[REFRESH_TOKEN.cookie.name] ||
        `${req.ip}-${(req.headers['user-agent'] as string) || ''}`
    return crypto.createHash('sha256').update(String(raw)).digest('hex')
}

export const doubleCsrfConfigOptions: DoubleCsrfConfigOptions = {
    getSecret: () => CSRF_SECRET,
    getSessionIdentifier,
    cookieName: CSRF_COOKIE_NAME,
    cookieOptions: {
        sameSite: 'strict',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 60 * 60 * 1000,
    },
    ignoredMethods: ['GET', 'HEAD', 'OPTIONS'],
    getCsrfTokenFromRequest: (req) => {
        const hdr = req.headers['x-csrf-token']
        const fromHeader = Array.isArray(hdr) ? hdr[0] : hdr
        const fromBody = (req as unknown as { body?: { _csrf?: string } }).body
            ?._csrf
        const fromQuery = (req as unknown as { query?: { _csrf?: string } })
            .query?._csrf
        return (fromHeader as string) ?? fromBody ?? fromQuery ?? ''
    },
}

const utils = doubleCsrf(doubleCsrfConfigOptions)

export const { doubleCsrfProtection, invalidCsrfTokenError, validateRequest } =
    utils

// Обёртка-генератор токена (совместима с разными версиями либы)
export const generateCsrfToken = (req: Request, res: Response): string => {
    const u = utils as unknown as {
        generateCsrfToken?: (req: Request, res: Response) => string
        generateToken?: (req: Request, res: Response) => string
    }
    if (typeof u.generateCsrfToken === 'function')
        return u.generateCsrfToken(req, res)
    if (typeof u.generateToken === 'function') return u.generateToken(req, res)
    throw new Error('csrf util has no generate function')
}

// Мидлварь: в тестовом/CI окружении CSRF отключаем, иначе включаем
export const csrfIfNotTest = isCiOrTest
    ? (_req: Request, _res: Response, next: NextFunction) => next()
    : doubleCsrfProtection
