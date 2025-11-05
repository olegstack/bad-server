import { randomBytes } from 'crypto'

export function generateCsrfToken() {
    return randomBytes(32).toString('hex')
}
