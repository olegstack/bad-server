import { Request, Response, NextFunction } from 'express'
import { constants } from 'http2'
import crypto from 'crypto'
import fs from 'fs/promises'
import path from 'path'
import BadRequestError from '../errors/bad-request-error'
import { validateMimeType } from '../utils/validateMimeType'
import { fileSizeConfig } from '../config'

/**
 * Контроллер загрузки файлов
 * POST /upload
 */
export const uploadFile = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        if (!req.file) {
            throw new BadRequestError('Файл не передан')
        }

        const { size, path: tempPath, originalname } = req.file

        // Проверка размера файла
        if (size < fileSizeConfig.minSize) {
            throw new BadRequestError(
                'Размер файла меньше минимально допустимого'
            )
        }
        if (size > fileSizeConfig.maxSize) {
            throw new BadRequestError(
                'Размер файла превышает максимальный лимит'
            )
        }

        // Проверяем MIME сигнатуру (безопасная проверка)
        const mimeType = await validateMimeType(tempPath)
        if (!mimeType) {
            throw new BadRequestError('Неверный тип файла')
        }

        // Безопасное новое имя (исключаем использование originalname)
        const ext = path.extname(originalname).toLowerCase()
        const safeName = crypto.randomBytes(16).toString('hex') + ext

        // Каталог загрузки
        const uploadDir = process.env.UPLOAD_PATH || 'uploads'
        const absoluteUploadDir = path.isAbsolute(uploadDir)
            ? uploadDir
            : path.join(process.cwd(), uploadDir)

        await fs.mkdir(absoluteUploadDir, { recursive: true })

        // Переносим файл из временной папки
        const newPath = path.join(absoluteUploadDir, safeName)
        await fs.rename(tempPath, newPath)

        // Стабильный путь для ответа клиенту (без оригинального имени)
        const publicFileName =
            '/' +
            [uploadDir, safeName].filter(Boolean).join('/').replace(/\\+/g, '/')

        return res.status(constants.HTTP_STATUS_CREATED).send({
            fileName: publicFileName,
            size,
            mimeType,
        })
    } catch (error) {
        return next(error)
    }
}
