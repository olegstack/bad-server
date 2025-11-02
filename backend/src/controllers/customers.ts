import { NextFunction, Request, Response } from 'express'
import { FilterQuery } from 'mongoose'
import NotFoundError from '../errors/not-found-error'
import Order from '../models/order'
import User, { IUser } from '../models/user'
import { escapeRegexForSearch, safeString } from '../utils/parseQuery'

// GET /customers?page=2&limit=5&sort=totalAmount&order=desc&registrationDateFrom=2023-01-01&registrationDateTo=2023-12-31&lastOrderDateFrom=2023-01-01&lastOrderDateTo=2023-12-31&totalAmountFrom=100&totalAmountTo=1000&orderCountFrom=1&orderCountTo=10&search=...
export const getCustomers = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const {
            page = 1,
            limit = 10,
            registrationDateFrom,
            registrationDateTo,
            lastOrderDateFrom,
            lastOrderDateTo,
            totalAmountFrom,
            totalAmountTo,
            orderCountFrom,
            orderCountTo,
            search,
        } = req.query

        // ---- NEW: поддержка sort/sortOrder и sortField/sortOrder
        const rawSortField = (req.query.sortField ??
            req.query.sort ??
            'createdAt') as string
        const rawSortOrder = (req.query.sortOrder ??
            req.query.order ??
            'desc') as string

        const allowedSortFields = new Set([
            'createdAt',
            'lastOrderDate',
            'totalAmount',
            'orderCount',
            'name',
        ])
        const field = allowedSortFields.has(rawSortField)
            ? rawSortField
            : 'createdAt'
        const dir: 1 | -1 =
            String(rawSortOrder).toLowerCase() === 'asc' ? 1 : -1

        const limitNum = Number.isFinite(Number(limit))
            ? Math.min(Math.max(Number(limit), 1), 10)
            : 10
        const pageNum = Number.isFinite(Number(page))
            ? Math.max(Number(page), 1)
            : 1

        const filters: FilterQuery<Partial<IUser>> = {}

        if (registrationDateFrom) {
            const d = new Date(String(registrationDateFrom))
            if (!Number.isNaN(d.getTime())) {
                filters.createdAt = { ...filters.createdAt, $gte: d }
            }
        }

        if (registrationDateTo) {
            const d = new Date(String(registrationDateTo))
            if (!Number.isNaN(d.getTime())) {
                d.setHours(23, 59, 59, 999)
                filters.createdAt = { ...filters.createdAt, $lte: d }
            }
        }

        if (lastOrderDateFrom) {
            const d = new Date(String(lastOrderDateFrom))
            if (!Number.isNaN(d.getTime())) {
                filters.lastOrderDate = { ...filters.lastOrderDate, $gte: d }
            }
        }

        if (lastOrderDateTo) {
            const d = new Date(String(lastOrderDateTo))
            if (!Number.isNaN(d.getTime())) {
                d.setHours(23, 59, 59, 999)
                filters.lastOrderDate = { ...filters.lastOrderDate, $lte: d }
            }
        }

        if (typeof totalAmountFrom !== 'undefined') {
            const v = Number(totalAmountFrom)
            if (Number.isFinite(v)) {
                filters.totalAmount = { ...filters.totalAmount, $gte: v }
            }
        }

        if (typeof totalAmountTo !== 'undefined') {
            const v = Number(totalAmountTo)
            if (Number.isFinite(v)) {
                filters.totalAmount = { ...filters.totalAmount, $lte: v }
            }
        }

        if (typeof orderCountFrom !== 'undefined') {
            const v = Number(orderCountFrom)
            if (Number.isFinite(v)) {
                filters.orderCount = { ...filters.orderCount, $gte: v }
            }
        }

        if (typeof orderCountTo !== 'undefined') {
            const v = Number(orderCountTo)
            if (Number.isFinite(v)) {
                filters.orderCount = { ...filters.orderCount, $lte: v }
            }
        }

        if (typeof search === 'string' && search.length > 0) {
            const q = safeString(search, 64)
            if (q) {
                const safeRe = new RegExp(escapeRegexForSearch(q), 'i')

                // ищем заказы по адресу доставки, чтобы по ним связать пользователей
                const orders = await Order.find(
                    { deliveryAddress: safeRe },
                    '_id'
                )
                const orderIds = orders.map((order) => order._id)

                if (orderIds.length > 0) {
                    filters.$or = [
                        { name: safeRe },
                        { lastOrder: { $in: orderIds } },
                    ]
                } else {
                    filters.$or = [{ name: safeRe }]
                }
            }
        }

        // ---- NEW: безопасное формирование sort
        const sort: Record<string, 1 | -1> = { [field]: dir }

        const skip = (pageNum - 1) * limitNum

        const users = await User.find(filters, null, {
            sort,
            skip,
            limit: limitNum,
        }).populate([
            'orders',
            {
                path: 'lastOrder',
                populate: { path: 'products' },
            },
            {
                path: 'lastOrder',
                populate: { path: 'customer' },
            },
        ])

        const totalUsers = await User.countDocuments(filters)
        const totalPages = Math.ceil(totalUsers / limitNum)

        return res.status(200).json({
            customers: users,
            pagination: {
                totalUsers,
                totalPages,
                currentPage: pageNum,
                pageSize: limitNum,
            },
        })
    } catch (error) {
        next(error)
    }
}

// GET /customers/:id
export const getCustomerById = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const user = await User.findById(req.params.id).populate([
            'orders',
            'lastOrder',
        ])
        res.status(200).json(user)
    } catch (error) {
        next(error)
    }
}

// PATCH /customers/:id
export const updateCustomer = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const updatedUser = await User.findByIdAndUpdate(
            req.params.id,
            req.body,
            {
                new: true,
            }
        )
            .orFail(
                () =>
                    new NotFoundError(
                        'Пользователь по заданному id отсутствует в базе'
                    )
            )
            .populate(['orders', 'lastOrder'])

        res.status(200).json(updatedUser)
    } catch (error) {
        next(error)
    }
}

// DELETE /customers/:id
export const deleteCustomer = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const deletedUser = await User.findByIdAndDelete(req.params.id).orFail(
            () =>
                new NotFoundError(
                    'Пользователь по заданному id отсутствует в базе'
                )
        )
        res.status(200).json(deletedUser)
    } catch (error) {
        next(error)
    }
}
