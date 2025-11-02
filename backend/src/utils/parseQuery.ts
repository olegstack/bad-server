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
