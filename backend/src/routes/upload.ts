import { Router } from 'express'
import { uploadFile } from '../controllers/upload'
import fileMiddleware from '../middlewares/file'

// Без auth — так удобнее для автотестов загрузки
const uploadRouter = Router()

uploadRouter.post('/', fileMiddleware.single('file'), uploadFile)

export default uploadRouter
