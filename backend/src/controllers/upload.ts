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

      
        if (req.file.size < fileSizeConfig.minSize) {
            await fs.unlink(req.file.path)
            return next(new BadRequestError('Размер файла слишком мал'))
        }

        if (req.file.size > fileSizeConfig.maxSize) {
            await fs.unlink(req.file.path)
            return next(new BadRequestError('Размер файла слишком велик'))
        }

        
        const mimeType = await validateMimeType(req.file.path)
        if (!mimeType || !allowedTypes.includes(mimeType)) {
            await fs.unlink(req.file.path)
            return next(new BadRequestError('Некорректный формат файла'))
        }

    
        const ext = path.extname(req.file.originalname)
        const safeName = crypto.randomBytes(16).toString('hex') + ext
        const uploadDir = process.env.UPLOAD_PATH || 'uploads'
        const newPath = path.join(uploadDir, safeName)

        await fs.mkdir(uploadDir, { recursive: true })
        await fs.rename(req.file.path, newPath)

        return res.status(constants.HTTP_STATUS_CREATED).send({
            fileName: `/${uploadDir}/${safeName}`,
            size: req.file.size,
            mimeType,
        })
    } catch (error) {
        return next(error)
    }
}

export default {}
