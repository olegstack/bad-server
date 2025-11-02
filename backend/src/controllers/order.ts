import { NextFunction, Request, Response } from 'express'
import { FilterQuery, Error as MongooseError, Types } from 'mongoose'
import BadRequestError from '../errors/bad-request-error'
import NotFoundError from '../errors/not-found-error'
import Order, { IOrder } from '../models/order'
import Product, { IProduct } from '../models/product'
import User from '../models/user'
import { escapeHtml, escapeRegexForSearch, safeString } from '../utils/parseQuery'

// eslint-disable-next-line max-len
// GET /orders?page=2&limit=5&sort=totalAmount&order=desc&orderDateFrom=2024-07-01&orderDateTo=2024-08-01&status=delivering&totalAmountFrom=100&totalAmountTo=1000&search=%2B1

export const getOrders = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const {
            page = 1,
            limit = 10,
            sortField = 'createdAt',
            sortOrder = 'desc',
            status,
            totalAmountFrom,
            totalAmountTo,
            orderDateFrom,
            orderDateTo,
            search,
        } = req.query

        const filters: FilterQuery<Partial<IOrder>> = {}

        const limitNum = Number.isFinite(Number(limit))
            ? Math.min(Math.max(Number(limit), 1), 10)
            : 10

        const pageNum = Number.isFinite(Number(page))
            ? Math.max(Number(page), 1)
            : 1

        if (typeof status !== 'undefined') {
            if (typeof status === 'string' && /^[a-zA-Z0-9_-]+$/.test(status)) {
                filters.status = status
            } else {
                throw new BadRequestError('Невалидный параметр статуса')
            }
        }

        if (typeof totalAmountFrom !== 'undefined') {
            const v = Number(totalAmountFrom)
            if (!Number.isFinite(v))
                throw new BadRequestError('Неверный totalAmountFrom')
            filters.totalAmount = { ...filters.totalAmount, $gte: v }
        }

        if (typeof totalAmountTo !== 'undefined') {
            const v = Number(totalAmountTo)
            if (!Number.isFinite(v))
                throw new BadRequestError('Неверный totalAmountTo')
            filters.totalAmount = { ...filters.totalAmount, $lte: v }
        }

        if (typeof orderDateFrom !== 'undefined') {
            const d = new Date(String(orderDateFrom))
            if (Number.isNaN(d.getTime()))
                throw new BadRequestError('Неверный orderDateFrom')
            filters.createdAt = { ...filters.createdAt, $gte: d }
        }

        if (typeof orderDateTo !== 'undefined') {
            const d = new Date(String(orderDateTo))
            if (Number.isNaN(d.getTime()))
                throw new BadRequestError('Неверный orderDateTo')
            filters.createdAt = { ...filters.createdAt, $lte: d }
        }

        const aggregatePipeline: any[] = [
            { $match: filters },
            {
                $lookup: {
                    from: 'products',
                    localField: 'products',
                    foreignField: '_id',
                    as: 'products',
                },
            },
            {
                $lookup: {
                    from: 'users',
                    localField: 'customer',
                    foreignField: '_id',
                    as: 'customer',
                },
            },
            { $unwind: '$customer' },
            { $unwind: '$products' },
        ]

        if (search) {
            const q = safeString(search, 64) // обрезаем и проверяем строку
            if (q) {
                const safeRe = new RegExp(escapeRegexForSearch(q), 'i')
                const asNumber = Number(q)
                const searchConditions: any[] = [{ 'products.title': safeRe }]

                if (Number.isFinite(asNumber)) {
                    searchConditions.push({ orderNumber: asNumber })
                }

                aggregatePipeline.push({
                    $match: { $or: searchConditions },
                })
                ;(filters as any).$or = searchConditions // чтобы countDocuments совпадал
            }
        }

        const sort: Record<string, 1 | -1> = {}
        if (sortField && sortOrder) {
            sort[sortField as string] = sortOrder === 'desc' ? -1 : 1
        }

        aggregatePipeline.push(
            { $sort: sort },
            {
                $skip: (Number(pageNum) - 1) * Number(limitNum),
            },
            { $limit: Number(limitNum) },
            {
                $group: {
                    _id: '$_id',
                    orderNumber: { $first: '$orderNumber' },
                    status: { $first: '$status' },
                    totalAmount: { $first: '$totalAmount' },
                    products: { $push: '$products' },
                    customer: { $first: '$customer' },
                    createdAt: { $first: '$createdAt' },
                },
            }
        )

        const orders = await Order.aggregate(aggregatePipeline)
        const totalOrders = await Order.countDocuments(filters)
        const totalPages = Math.ceil(totalOrders / Number(limitNum))

        res.status(200).json({
            orders,
            pagination: {
                totalOrders,
                totalPages,
                currentPage: Number(pageNum),
                pageSize: Number(limitNum),
            },
        })
    } catch (error) {
        next(error)
    }
}

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

        const user = await User.findById(userId)
            .populate({
                path: 'orders',
                populate: [
                    {
                        path: 'products',
                    },
                    {
                        path: 'customer',
                    },
                ],
            })
            .orFail(
                () =>
                    new NotFoundError(
                        'Пользователь по заданному id отсутствует в базе'
                    )
            )

        let orders = user.orders as unknown as IOrder[]

        if (search) {
            const q = safeString(search, 64)
            if (q) {
                // если не экранировать то получаем Invalid regular expression: /+1/i: Nothing to repeat
                const searchRegex = new RegExp(search as string, 'i')
                const searchNumber = Number(search)

                const products = await Product.find({ title: searchRegex })
                const productIds = products.map((product) => product._id)

                orders = orders.filter((order) => {
                    // eslint-disable-next-line max-len
                    const matchesProductTitle = order.products.some((product) =>
                        productIds.some((id) => id.equals(product._id))
                    )
                    // eslint-disable-next-line max-len
                    const matchesOrderNumber =
                        !Number.isNaN(searchNumber) &&
                        order.orderNumber === searchNumber

                    return matchesOrderNumber || matchesProductTitle
                })
            }
        }

        const totalOrders = orders.length
        const totalPages = Math.ceil(totalOrders /  limitNum)

        orders = orders.slice(skip, skip + limitNum)

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

// Get order by ID
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
            // Если нет доступа не возвращаем 403, а отдаем 404
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

// POST /product
export const createOrder = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const basket: IProduct[] = []
        const products = await Product.find<IProduct>({})
        const userId = res.locals.user._id
        const { address, payment, phone, total, email, items, comment } =
            req.body

        // Валидация телефона (простой формат: + и 7–15 цифр)
        const phoneNorm = String(phone ?? '').replace(/[^\d+]/g, '')
        if (!/^\+?\d{7,15}$/.test(phoneNorm)) {
            return next(new BadRequestError('Неверный формат телефона'))
        }

        // Санитизация комментария (экранируем HTML)
        const safeComment = escapeHtml(comment, 1024)

        items.forEach((id: Types.ObjectId) => {
            const product = products.find((p) => p._id.equals(id))
            if (!product) {
                throw new BadRequestError(`Товар с id ${id} не найден`)
            }
            if (product.price === null) {
                throw new BadRequestError(`Товар с id ${id} не продается`)
            }
            return basket.push(product)
        })
        const totalBasket = basket.reduce((a, c) => a + c.price, 0)
        if (totalBasket !== total) {
            return next(new BadRequestError('Неверная сумма заказа'))
        }

        const newOrder = new Order({
            totalAmount: total,
            products: items,
            payment,
            phone: phoneNorm,
            email,
            comment: safeComment,
            customer: userId,
            deliveryAddress: address,
        })
        const populateOrder = await newOrder.populate(['customer', 'products'])
        await populateOrder.save()

        return res.status(200).json(populateOrder)
    } catch (error) {
        if (error instanceof MongooseError.ValidationError) {
            return next(new BadRequestError(error.message))
        }
        return next(error)
    }
}

// Update an order
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

// Delete an order
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
