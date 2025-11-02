import { NextFunction, Request, Response } from 'express'
import fs from 'fs'
import path from 'path'

/**
 * Безопасная раздача статики из указанной папки.
 * Не допускает обхода через "../" и другие path traversal.
 */
export default function serveStatic(baseDir: string) {
    return (req: Request, res: Response, next: NextFunction) => {
        // Формируем полный путь к файлу
        const filePath = path.join(baseDir, req.path)

        // Проверка безопасности пути (чтобы нельзя было подняться выше baseDir)
        const absReq = path.resolve(filePath)
        const absBase = path.resolve(baseDir)
        if (!absReq.startsWith(absBase)) return next()

        fs.access(absReq, fs.constants.F_OK, (err) => {
            if (err) {
                // Файл не найден — передаём дальше
                return next()
            }
            // Файл найден — отправляем
            return res.sendFile(absReq, (err) => {
                if (err) next(err)
            })
        })
    }
}
