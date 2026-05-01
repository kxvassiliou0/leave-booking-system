import request from 'supertest'
import express, { Router } from 'express'
import { LoginRouter } from './LoginRouter'
import { LoginController } from '../controllers/LoginController'
import { StatusCodes } from 'http-status-codes'

const mockLoginController = {
  login: jest.fn((req, res) => res.status(StatusCodes.ACCEPTED).send('mocked-token')),
} as unknown as LoginController

const router = Router()
const app = express()
app.use(express.json())

const loginRouter = new LoginRouter(router, mockLoginController)
app.use('/login', loginRouter.getRouter())

describe('LoginRouter', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('POST / calls login', async () => {
    const response = await request(app).post('/login').send({ email: 'a@b.com', password: 'pass' })

    expect(mockLoginController.login).toHaveBeenCalled()
    expect(response.status).toBe(StatusCodes.ACCEPTED)
    expect(response.text).toBe('mocked-token')
  })

  it('router.post was called with / on construction', () => {
    const freshRouter = Router()
    jest.spyOn(freshRouter, 'post')

    new LoginRouter(freshRouter, mockLoginController)

    expect(freshRouter.post).toHaveBeenCalledWith('/', mockLoginController.login)
  })
})
