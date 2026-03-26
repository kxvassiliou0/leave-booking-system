import request from 'supertest'
import express, { Router } from 'express'
import { UserRouter } from './UserRouter'
import { UserController } from '../controllers/UserController'
import { StatusCodes } from 'http-status-codes'

const mockUserController = {
  getAll: jest.fn((_req, res) => res.status(StatusCodes.OK).json([])),
  getById: jest.fn((req, res) => res.status(StatusCodes.OK).json({ id: req.params.id })),
  create: jest.fn((req, res) => res.status(StatusCodes.CREATED).json(req.body)),
  update: jest.fn((req, res) => res.status(StatusCodes.OK).json(req.body)),
  delete: jest.fn((req, res) => res.status(StatusCodes.OK).json({ id: req.params.id })),
} as unknown as UserController

const router = Router()
jest.spyOn(router, 'get')
jest.spyOn(router, 'post')
jest.spyOn(router, 'patch')
jest.spyOn(router, 'delete')

const app = express()
app.use(express.json())

const userRouter = new UserRouter(router, mockUserController)
app.use('/users', userRouter.getRouter())

const BASE_URL = '/users'

describe('UserRouter', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('GET /users calls getAll', async () => {
    const response = await request(app).get(BASE_URL)

    expect(mockUserController.getAll).toHaveBeenCalled()
    expect(response.status).toBe(StatusCodes.OK)
    expect(response.body).toEqual([])
  })

  it('GET /users/:id calls getById', async () => {
    const id = '1'
    const response = await request(app).get(`${BASE_URL}/${id}`)

    const reqArg = (mockUserController.getById as jest.Mock).mock.calls[0][0]
    expect(reqArg.originalUrl).toBe(`${BASE_URL}/${id}`)
    expect(mockUserController.getById).toHaveBeenCalled()
    expect(response.status).toBe(StatusCodes.OK)
    expect(response.body).toEqual({ id })
  })

  it('POST /users calls create', async () => {
    const newUser = { firstName: 'Alice', lastName: 'Johnson', email: 'alice@company.com' }

    const response = await request(app).post(BASE_URL).send(newUser)

    const body = (mockUserController.create as jest.Mock).mock.calls[0][0].body
    expect(body).toStrictEqual(newUser)
    expect(mockUserController.create).toHaveBeenCalled()
    expect(response.status).toBe(StatusCodes.CREATED)
  })

  it('PATCH /users/:id calls update', async () => {
    const id = '1'
    const updateData = { firstName: 'Bob' }

    const response = await request(app).patch(`${BASE_URL}/${id}`).send(updateData)

    const reqArg = (mockUserController.update as jest.Mock).mock.calls[0][0]
    expect(reqArg.originalUrl).toBe(`${BASE_URL}/${id}`)
    expect(reqArg.body).toStrictEqual(updateData)
    expect(mockUserController.update).toHaveBeenCalled()
    expect(response.status).toBe(StatusCodes.OK)
  })

  it('DELETE /users/:id calls delete', async () => {
    const id = '1'

    const response = await request(app).delete(`${BASE_URL}/${id}`)

    const reqArg = (mockUserController.delete as jest.Mock).mock.calls[0][0]
    expect(reqArg.originalUrl).toBe(`${BASE_URL}/${id}`)
    expect(mockUserController.delete).toHaveBeenCalled()
    expect(response.status).toBe(StatusCodes.OK)
  })
})
