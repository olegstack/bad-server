import { NextFunction, Request, Response } from 'express'
import { constants } from 'http2'
import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'crypto'

import BadRequestError from '../errors/bad-request-error'
import { validateMimeType } from '../utils/validateMimeType'
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

        // 1) Лимиты размера
        if (req.file.size < fileSizeConfig.minSize) {
            await fs.unlink(req.file.path)
            return next(new BadRequestError('Размер файла слишком мал'))
        }
        if (req.file.size > fileSizeConfig.maxSize) {
            await fs.unlink(req.file.path)
            return next(new BadRequestError('Размер файла слишком велик'))
        }

        // 2) Проверяем реальный MIME по сигнатуре, а не по расширению
        const mimeType = await validateMimeType(req.file.path)
        if (!mimeType || !mimeType.startsWith('image/')) {
            await fs.unlink(req.file.path)
            return next(new BadRequestError('Некорректный формат файла'))
        }

        // 3) Генерируем безопасное имя: <random>.<ext>, БЕЗ оригинального basename
        const ext = path.extname(req.file.originalname || '').toLowerCase()
        const safeExt = ext && ext.length <= 10 ? ext : '' // на всякий случай
        const safeName = crypto.randomBytes(16).toString('hex') + safeExt

        // 4) Директория загрузок (по умолчанию "uploads" в корне проекта)
        const uploadDir = process.env.UPLOAD_PATH || 'uploads'
        const absoluteUploadDir = path.isAbsolute(uploadDir)
            ? uploadDir
            : path.join(process.cwd(), uploadDir)

        await fs.mkdir(absoluteUploadDir, { recursive: true })

        // 5) Переносим файл
        const newPath = path.join(absoluteUploadDir, safeName)
        await fs.rename(req.file.path, newPath)

        // 6) Публичный путь (без оригинального имени!)
        const publicFileName =
            '/' +
            [uploadDir, safeName].filter(Boolean).join('/').replace(/\\+/g, '/')

        return res.status(constants.HTTP_STATUS_CREATED).send({
            fileName: publicFileName,
            size: req.file.size,
            mimeType,
        })
    } catch (error) {
        return next(error)
    }
}

export default {}
