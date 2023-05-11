import express from 'express'
import { asyncHandler } from '../../../helpers/asyncHandler'
import cartController from '../../../restAPI/controllers/cart.controller'

//
const route = express.Router()
//
route.post('/add', asyncHandler(cartController.addToCart))
route.post('/update', asyncHandler(cartController.updateProductQuantity))
route.post('/delete', asyncHandler(cartController.deleteItemAllCart))
route.post('/delete_item', asyncHandler(cartController.deleteCartItemById))
route.get('/get', asyncHandler(cartController.getListCartItem))
//
module.exports = route
