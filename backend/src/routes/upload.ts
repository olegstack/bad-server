import { Router } from 'express'
import { uploadFile } from '../controllers/upload'
import fileMiddleware from '../middlewares/file'
import { doubleCsrfProtection } from '../middlewares/csrf'

const uploadRouter = Router()
uploadRouter.post(
    '/',
    doubleCsrfProtection,
    fileMiddleware.single('file'),
    uploadFile
)

export default uploadRouter
