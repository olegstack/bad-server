import { NextFunction, Request, Response } from 'express'
import { FilterQuery, Error as MongooseError, Types } from 'mongoose'
import BadRequestError from '../errors/bad-request-error'
import NotFoundError from '../errors/not-found-error'
import Order, { IOrder } from '../models/order'
import Product, { IProduct } from '../models/product'
import {
    escapeHtml,
    escapeRegexForSearch,
    safeString,
} from '../utils/parseQuery'

/**
 * GET /orders
 */
export const getOrders = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        //  если в URL просочились массивы/объекты через query-string
        const orig = req.originalUrl || ''
        if (
            orig.includes('search[') ||
            orig.toLowerCase().includes('search%5b')
        ) {
            return next(new BadRequestError('Некорректный параметр поиска'))
        }

        const {
            page = 1,
            limit = 10,
            status,
            totalAmountFrom,
            totalAmountTo,
            orderDateFrom,
            orderDateTo,
            search,
        } = req.query

        const limitNum = Number.isFinite(Number(limit))
            ? Math.min(Math.max(Number(limit), 1), 10)
            : 10
        const pageNum = Number.isFinite(Number(page))
            ? Math.max(Number(page), 1)
            : 1

        // Сортировка (совместимость с ?sort / ?order)
        const rawSortField = (req.query.sortField ??
            (req.query as any).sort ??
            'createdAt') as string
        const rawSortOrder = (req.query.sortOrder ??
            (req.query as any).order ??
            'desc') as string
        const allowedSortFields = new Set([
            'createdAt',
            'totalAmount',
            'orderNumber',
            'status',
        ])
        const field = allowedSortFields.has(rawSortField)
            ? rawSortField
            : 'createdAt'
        const dir: 1 | -1 =
            String(rawSortOrder).toLowerCase() === 'asc' ? 1 : -1
        const sortStage = allowedSortFields.has(field)
            ? [{ $sort: { [field]: dir } }]
            : []

        const filters: FilterQuery<Partial<IOrder>> = {}

        if (typeof status === 'string' && /^[a-zA-Z0-9_-]+$/.test(status)) {
            filters.status = status
        }

        if (typeof totalAmountFrom !== 'undefined') {
            const v = Number(totalAmountFrom)
            if (Number.isFinite(v))
                filters.totalAmount = { ...filters.totalAmount, $gte: v }
        }
        if (typeof totalAmountTo !== 'undefined') {
            const v = Number(totalAmountTo)
            if (Number.isFinite(v))
                filters.totalAmount = { ...filters.totalAmount, $lte: v }
        }

        if (typeof orderDateFrom !== 'undefined') {
            const d = new Date(String(orderDateFrom))
            if (!Number.isNaN(d.getTime()))
                filters.createdAt = { ...filters.createdAt, $gte: d }
        }
        if (typeof orderDateTo !== 'undefined') {
            const d = new Date(String(orderDateTo))
            if (!Number.isNaN(d.getTime()))
                filters.createdAt = { ...filters.createdAt, $lte: d }
        }

        // 🔒 Строгая валидация search
        if (typeof search !== 'undefined') {
            if (typeof search !== 'string') {
                return next(new BadRequestError('Некорректный параметр поиска'))
            }
            const qRaw = safeString(search, 64)
            if (!qRaw) {
                return next(new BadRequestError('Некорректный параметр поиска'))
            }
            // Блокируем символы, характерные для инъекций/операторов
            if (/[{}\[\]\$:]/.test(qRaw)) {
                return next(new BadRequestError('Некорректный параметр поиска'))
            }
        }

        // Поиск (если строка валидна)
        if (typeof search === 'string' && search.length > 0) {
            const q = safeString(search, 64)
            if (q) {
                const safeRe = new RegExp(escapeRegexForSearch(q), 'i')
                const asNumber = Number(q)

                const productIds = (
                    await Product.find({ title: safeRe }, { _id: 1 })
                ).map((p) => p._id)

                const or: any[] = []
                if (productIds.length > 0)
                    or.push({ products: { $in: productIds } })
                if (Number.isFinite(asNumber))
                    or.push({ orderNumber: asNumber })
                if (or.length > 0) (filters as any).$or = or
            }
        }

        const skip = (pageNum - 1) * limitNum

        const facetPipeline = [
            { $match: filters },
            {
                $facet: {
                    data: [
                        ...sortStage,
                        { $skip: skip },
                        { $limit: limitNum },
                        {
                            $lookup: {
                                from: 'users',
                                localField: 'customer',
                                foreignField: '_id',
                                as: 'customer',
                            },
                        },
                        {
                            $unwind: {
                                path: '$customer',
                                preserveNullAndEmptyArrays: true,
                            },
                        },
                        {
                            $lookup: {
                                from: 'products',
                                localField: 'products',
                                foreignField: '_id',
                                as: 'products',
                            },
                        },
                    ],
                    count: [{ $count: 'total' }],
                },
            },
        ] as any[]

        const [{ data = [], count = [] } = {}] =
            await Order.aggregate(facetPipeline)
        const totalOrders = count[0]?.total ?? 0
        const totalPages = Math.ceil(totalOrders / limitNum)

        return res.status(200).json({
            orders: data,
            pagination: {
                totalOrders,
                totalPages,
                currentPage: pageNum,
                pageSize: limitNum,
            },
        })
    } catch (error) {
        next(error)
    }
}

/**
 * GET /order/me
 */
export const getOrdersCurrentUser = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const userId = res.locals.user._id
        const { search, page = 1, limit = 5 } = req.query

        const limitNum = Number.isFinite(Number(limit))
            ? Math.min(Math.max(Number(limit), 1), 10)
            : 5
        const pageNum = Number.isFinite(Number(page))
            ? Math.max(Number(page), 1)
            : 1
        const skip = (pageNum - 1) * limitNum

        const filters: FilterQuery<Partial<IOrder>> = { customer: userId }

        if (typeof search === 'string' && search.length > 0) {
            const q = safeString(search, 64)
            if (q) {
                const safeRe = new RegExp(escapeRegexForSearch(q), 'i')
                const asNumber = Number(q)

                const productIds = (
                    await Product.find({ title: safeRe }, { _id: 1 })
                ).map((p) => p._id)

                const or: any[] = []
                if (productIds.length > 0)
                    or.push({ products: { $in: productIds } })
                if (Number.isFinite(asNumber))
                    or.push({ orderNumber: asNumber })
                if (or.length > 0) (filters as any).$or = or
            }
        }

        const [orders, totalOrders] = await Promise.all([
            Order.find(filters)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limitNum)
                .populate(['customer', 'products']),
            Order.countDocuments(filters),
        ])

        const totalPages = Math.ceil(totalOrders / limitNum)

        return res.send({
            orders,
            pagination: {
                totalOrders,
                totalPages,
                currentPage: pageNum,
                pageSize: limitNum,
            },
        })
    } catch (error) {
        next(error)
    }
}

/** GET /orders/:orderNumber (admin) */
export const getOrderByNumber = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const order = await Order.findOne({
            orderNumber: req.params.orderNumber,
        })
            .populate(['customer', 'products'])
            .orFail(
                () =>
                    new NotFoundError(
                        'Заказ по заданному id отсутствует в базе'
                    )
            )
        return res.status(200).json(order)
    } catch (error) {
        if (error instanceof MongooseError.CastError) {
            return next(new BadRequestError('Передан не валидный ID заказа'))
        }
        return next(error)
    }
}

/** GET /order/me/:orderNumber */
export const getOrderCurrentUserByNumber = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    const userId = res.locals.user._id
    try {
        const order = await Order.findOne({
            orderNumber: req.params.orderNumber,
        })
            .populate(['customer', 'products'])
            .orFail(
                () =>
                    new NotFoundError(
                        'Заказ по заданному id отсутствует в базе'
                    )
            )

        if (!order.customer._id.equals(userId)) {
            return next(
                new NotFoundError('Заказ по заданному id отсутствует в базе')
            )
        }
        return res.status(200).json(order)
    } catch (error) {
        if (error instanceof MongooseError.CastError) {
            return next(new BadRequestError('Передан не валидный ID заказа'))
        }
        return next(error)
    }
}

/** POST /order */
export const createOrder = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const { address, payment, phone, total, email, items, comment } =
            req.body as {
                address: string
                payment: string
                phone: string
                total: number
                email: string
                items: string[]
                comment?: string
            }

        if (!Array.isArray(items) || items.length === 0) {
            return next(new BadRequestError('Не указаны товары'))
        }

        const phoneNorm = String(phone ?? '').replace(/[^\d+]/g, '')
        if (!/^\+?\d{7,15}$/.test(phoneNorm)) {
            return next(new BadRequestError('Неверный формат телефона'))
        }

        const ids = items.map((id) => new Types.ObjectId(id))
        const products = await Product.find<IProduct>({ _id: { $in: ids } })
        if (products.length !== ids.length) {
            return next(new BadRequestError('Некоторые товары не найдены'))
        }

        const totalBasket = products.reduce((sum, p) => {
            if (p.price === null || typeof p.price !== 'number') {
                throw new BadRequestError(`Товар "${p.title}" не продаётся`)
            }
            return sum + p.price
        }, 0)

        if (totalBasket !== total) {
            return next(new BadRequestError('Неверная сумма заказа'))
        }

        const userId = res.locals.user._id
        const safeComment = escapeHtml(comment, 1024)

        const newOrder = new Order({
            totalAmount: total,
            products: ids,
            payment,
            phone: phoneNorm,
            email,
            comment: safeComment,
            customer: userId,
            deliveryAddress: address,
        })

        await newOrder.save()
        const populated = await newOrder.populate(['customer', 'products'])

        return res.status(200).json(populated)
    } catch (error) {
        if (error instanceof MongooseError.ValidationError) {
            return next(new BadRequestError(error.message))
        }
        return next(error)
    }
}

/** PATCH /orders/:orderNumber (admin) */
export const updateOrder = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const { status } = req.body
        const updatedOrder = await Order.findOneAndUpdate(
            { orderNumber: req.params.orderNumber },
            { status },
            { new: true, runValidators: true }
        )
            .orFail(
                () =>
                    new NotFoundError(
                        'Заказ по заданному id отсутствует в базе'
                    )
            )
            .populate(['customer', 'products'])

        return res.status(200).json(updatedOrder)
    } catch (error) {
        if (error instanceof MongooseError.ValidationError) {
            return next(new BadRequestError(error.message))
        }
        if (error instanceof MongooseError.CastError) {
            return next(new BadRequestError('Передан не валидный ID заказа'))
        }
        return next(error)
    }
}

/** DELETE /orders/:id (admin) */
export const deleteOrder = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const deletedOrder = await Order.findByIdAndDelete(req.params.id)
            .orFail(
                () =>
                    new NotFoundError(
                        'Заказ по заданному id отсутствует в базе'
                    )
            )
            .populate(['customer', 'products'])

        return res.status(200).json(deletedOrder)
    } catch (error) {
        if (error instanceof MongooseError.CastError) {
            return next(new BadRequestError('Передан не валидный ID заказа'))
        }
        return next(error)
    }
}
