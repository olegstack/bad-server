import crypto from 'crypto'
import type { Request, Response } from 'express'
import { doubleCsrf, type DoubleCsrfConfigOptions } from 'csrf-csrf'
import { CSRF_SECRET, CSRF_COOKIE_NAME, REFRESH_TOKEN } from '../config'

const getSessionIdentifier = (req: Request) => {
    const raw =
        req.cookies?.[REFRESH_TOKEN.cookie.name] ||
        (req.headers['x-forwarded-for'] as string) ||
        req.ip ||
        (req.headers['user-agent'] as string) ||
        'anon'
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
        const fromBody = (req as any).body?._csrf
        const fromQuery = (req as any).query?._csrf
        return (
            (fromHeader as string) ??
            (fromBody as string) ??
            (fromQuery as string) ??
            ''
        )
    },
}

const utils = doubleCsrf(doubleCsrfConfigOptions) as any

export const { doubleCsrfProtection, invalidCsrfTokenError, validateRequest } =
    utils

// Универсальная обёртка: корректно вызывает generateCsrfToken / generateToken
// и имеет сигнатуру (req, res) => string
export const generateCsrfToken = (req: Request, res: Response): string => {
    try {
        if (typeof utils.generateCsrfToken === 'function') {
            // новые версии библиотеки
            return utils.generateCsrfToken(req, res)
        }
        if (typeof utils.generateToken === 'function') {
            // более старые версии
            return utils.generateToken(req, res)
        }
        throw new Error('csrf util has no generate function')
    } catch (err) {
        // логируем деталь для диагностики
        // (можешь использовать winston/logger вместо console)
        console.error('Failed to generate CSRF token:', err)
        throw err
    }
}
