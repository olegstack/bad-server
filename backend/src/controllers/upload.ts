import { NextFunction, Request, Response } from 'express'
import { constants } from 'http2'
import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'crypto'
import { allowedTypes } from '../middlewares/file'
import { validateMimeType } from '../utils/validateMimeType'
import BadRequestError from '../errors/bad-request-error'
import { fileSizeConfig } from '../config'

export const uploadFile = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        if (!req.file) {
            return next(new BadRequestError('Файл не загружен'))
        }

        const { size, originalname, path: tmpPath } = req.file

        if (size < fileSizeConfig.minSize) {
            await fs.unlink(tmpPath)
            return next(new BadRequestError('Размер файла слишком мал'))
        }
        if (size > fileSizeConfig.maxSize) {
            await fs.unlink(tmpPath)
            return next(new BadRequestError('Размер файла слишком велик'))
        }

        // Определяем фактический MIME (по сигнатуре/контенту)
        const mimeType = await validateMimeType(tmpPath)
        if (!mimeType || !mimeType.startsWith('image/')) {
            await fs.unlink(tmpPath)
            return next(new BadRequestError('Некорректный формат файла'))
        }

        // Генерируем безопасное имя
        const ext = path.extname(originalname || '').toLowerCase() || '.bin'
        const safeName = crypto.randomBytes(16).toString('hex') + ext

        // Нормализуем базовую директорию загрузок
        const envUpload = process.env.UPLOAD_PATH || 'uploads'
        // всегда приводим к относительному виду под проект
        const uploadRel = envUpload
            .replace(/^(\.+[\\/])+/, '')
            .replace(/^\/+/, '')
        const absoluteUploadDir = path.join(process.cwd(), uploadRel)

        await fs.mkdir(absoluteUploadDir, { recursive: true })
        const newPath = path.join(absoluteUploadDir, safeName)

        await fs.rename(tmpPath, newPath)

        // Публичный путь (без абсолютных директорий ОС)
        const publicFileName =
            '/' +
            [uploadRel, safeName].filter(Boolean).join('/').replace(/\\+/g, '/')

        return res.status(constants.HTTP_STATUS_CREATED).send({
            fileName: publicFileName,
            size,
            mimeType,
        })
    } catch (error) {
        try {
            if (req.file?.path) await fs.unlink(req.file.path).catch(() => {})
        } catch {}
        return next(error)
    }
}

export default {}
