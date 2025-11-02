import { Joi, celebrate } from 'celebrate'
import { Types } from 'mongoose'

// eslint-disable-next-line no-useless-escape
export const phoneRegExp = /^\+?\d{7,15}$/

export enum PaymentType {
    Card = 'card',
    Online = 'online',
}

// Валидация тела заказа
export const validateOrderBody = celebrate({
    body: Joi.object().keys({
        items: Joi.array()
            .items(
                Joi.string().custom((value, helpers) => {
                    if (Types.ObjectId.isValid(value)) {
                        return value
                    }
                    return helpers.message({ custom: 'Невалидный id' })
                })
            )
            .min(1)
            .required()
            .messages({
                'array.min': 'Не указаны товары',
                'any.required': 'Поле items обязательно',
            }),

        payment: Joi.string()
            .valid(...Object.values(PaymentType))
            .required()
            .messages({
                'string.valid':
                    'Указано невалидное значение для способа оплаты. Возможные значения — "card" или "online"',
                'string.empty': 'Не указан способ оплаты',
            }),

        email: Joi.string().email().required().messages({
            'string.empty': 'Не указан email',
            'string.email': 'Поле email должно быть валидным',
        }),

        phone: Joi.string()
            .required()
            .custom((value, helpers) => {
                const norm = String(value).replace(/[^\d+]/g, '')
                if (!phoneRegExp.test(norm)) {
                    return helpers.error('any.invalid')
                }
                return norm
            })
            .messages({
                'string.empty': 'Не указан телефон',
                'any.invalid': 'Неверный формат телефона',
            }),

        address: Joi.string().required().messages({
            'string.empty': 'Не указан адрес доставки',
        }),

        total: Joi.number().required().messages({
            'number.base': 'Неверный формат суммы заказа',
            'any.required': 'Не указана сумма заказа',
        }),

        comment: Joi.string().optional().allow(''),
    }),
})

// Валидация товара
export const validateProductBody = celebrate({
    body: Joi.object().keys({
        title: Joi.string().required().min(2).max(30).messages({
            'string.min': 'Минимальная длина поля "title" — 2',
            'string.max': 'Максимальная длина поля "title" — 30',
            'string.empty': 'Поле "title" должно быть заполнено',
        }),
        image: Joi.object().keys({
            fileName: Joi.string().required(),
            originalName: Joi.string().required(),
        }),
        category: Joi.string().required().messages({
            'string.empty': 'Поле "category" должно быть заполнено',
        }),
        description: Joi.string().required().messages({
            'string.empty': 'Поле "description" должно быть заполнено',
        }),
        price: Joi.number().allow(null),
    }),
})

export const validateProductUpdateBody = celebrate({
    body: Joi.object().keys({
        title: Joi.string().min(2).max(30).messages({
            'string.min': 'Минимальная длина поля "title" — 2',
            'string.max': 'Максимальная длина поля "title" — 30',
        }),
        image: Joi.object().keys({
            fileName: Joi.string().required(),
            originalName: Joi.string().required(),
        }),
        category: Joi.string(),
        description: Joi.string(),
        price: Joi.number().allow(null),
    }),
})

export const validateObjId = celebrate({
    params: Joi.object().keys({
        productId: Joi.string()
            .required()
            .custom((value, helpers) => {
                if (Types.ObjectId.isValid(value)) {
                    return value
                }
                return helpers.message({ any: 'Невалидный id' })
            }),
    }),
})

export const validateUserBody = celebrate({
    body: Joi.object().keys({
        name: Joi.string().min(2).max(30).messages({
            'string.min': 'Минимальная длина поля "name" — 2',
            'string.max': 'Максимальная длина поля "name" — 30',
        }),
        password: Joi.string().min(6).required().messages({
            'string.empty': 'Поле "password" должно быть заполнено',
        }),
        email: Joi.string()
            .required()
            .email()
            .message('Поле "email" должно быть валидным email-адресом')
            .messages({
                'string.empty': 'Поле "email" должно быть заполнено',
            }),
    }),
})

export const validateAuthentication = celebrate({
    body: Joi.object().keys({
        email: Joi.string()
            .required()
            .email()
            .message('Поле "email" должно быть валидным email-адресом')
            .messages({
                'string.required': 'Поле "email" должно быть заполнено',
            }),
        password: Joi.string().required().messages({
            'string.empty': 'Поле "password" должно быть заполнено',
        }),
    }),
})
