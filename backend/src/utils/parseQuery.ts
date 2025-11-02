export const safeString = (v: unknown, maxLen = 256): string | null => {
    if (typeof v === 'string') {
        const s = v.trim()
        if (!s) return null
        return s.length > maxLen ? s.slice(0, maxLen) : s
    }
    return null
}

export const escapeRegexForSearch = (v: string, maxLen = 64): string => {
    const s = v.slice(0, maxLen)
    // экранируем регэксп-метасимволы
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export const escapeHtml = (s: unknown, maxLen = 1024): string => {
    const str = String(s ?? '').slice(0, maxLen)
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
}
