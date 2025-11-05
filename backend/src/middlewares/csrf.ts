// src/middlewares/csrf.ts
import * as crypto from 'crypto'
import type { Request, Response } from 'express'
import { doubleCsrf, type DoubleCsrfConfigOptions } from 'csrf-csrf'
import { CSRF_SECRET, CSRF_COOKIE_NAME, REFRESH_TOKEN } from '../config'

const getSessionIdentifier = (req: Request): string => {
    const raw =
        req.cookies?.[REFRESH_TOKEN.cookie.name] ||
        `${req.ip}-${(req.headers['user-agent'] as string) || ''}`
    return crypto.createHash('sha256').update(String(raw)).digest('hex')
}

const getCsrfTokenFromRequest = (req: Request): string => {
    const hdr = req.headers['x-csrf-token']
    const fromHeader = Array.isArray(hdr) ? hdr[0] : hdr
    const fromBody = (req as any)?.body?._csrf
    const fromQuery = (req as any)?.query?._csrf
    return (fromHeader as string) ?? fromBody ?? fromQuery ?? ''
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
    getCsrfTokenFromRequest,
}

type CsrfUtilsCompat = ReturnType<typeof doubleCsrf> & {
    generateCsrfToken?: (req: Request, res: Response) => string
    generateToken?: (req: Request, res: Response) => string
}

const utils = doubleCsrf(doubleCsrfConfigOptions) as CsrfUtilsCompat

export const { doubleCsrfProtection, invalidCsrfTokenError, validateRequest } =
    utils

export const generateCsrfToken = (req: Request, res: Response): string => {
    if (typeof utils.generateToken === 'function')
        return utils.generateToken(req, res)
    if (typeof utils.generateCsrfToken === 'function')
        return utils.generateCsrfToken(req, res)
    throw new Error('csrf-csrf: no generate* function found')
}
