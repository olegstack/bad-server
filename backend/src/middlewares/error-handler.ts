import { ErrorRequestHandler } from 'express'

const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
    const statusCode = (err && (err as any).statusCode) || 500
    const message =
        statusCode === 500 ? 'На сервере произошла ошибка' : err.message
    console.error(err)
    res.status(statusCode).send({ message })

}

export default errorHandler
