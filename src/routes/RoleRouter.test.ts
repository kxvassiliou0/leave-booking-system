import request from 'supertest'
import express, { Router } from 'express'
import { RoleRouter } from './RoleRouter'
import { RoleController } from '../controllers/RoleController'
import { StatusCodes } from 'http-status-codes'

const mockRoleController = {
  delete: jest.fn((req, res) => res.status(StatusCodes.OK).json({ id: req.params.id })),
  getAll: jest.fn((_req, res) => res.status(StatusCodes.OK).json([])),
  getById: jest.fn((req, res) => res.status(StatusCodes.OK).json({ id: req.params.id })),
  create: jest.fn((req, res) => res.status(StatusCodes.CREATED).json(req.body)),
  update: jest.fn((req, res) => res.status(StatusCodes.OK).json(req.body)),
} as unknown as RoleController

const router = Router()
jest.spyOn(router, 'get')
jest.spyOn(router, 'post')
jest.spyOn(router, 'patch')
jest.spyOn(router, 'delete')

const app = express()
app.use(express.json())

const roleRouter = new RoleRouter(router, mockRoleController)
app.use('/roles', roleRouter.getRouter())

const BASE_ROLES_URL = '/roles'

describe('RoleRouter', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('getAll on GET /roles can be called', async () => {
    const response = await request(app).get(BASE_ROLES_URL)

    expect(mockRoleController.getAll).toHaveBeenCalled()
    expect(response.status).toBe(StatusCodes.OK)
    expect(response.body).toEqual([])
  })

  it('getById route GET /roles/:id can be called', async () => {
    const id = '1'
    const endPoint = `${BASE_ROLES_URL}/${id}`

    const response = await request(app).get(endPoint)

    const reqArg = (mockRoleController.getById as jest.Mock).mock.calls[0][0]
    expect(reqArg.originalUrl).toBe(endPoint)
    expect(response.status).toBe(StatusCodes.OK)
    expect(response.body).toEqual({ id })
  })

  it('create route POST /roles can be called', async () => {
    const newRoleData = { name: 'manager' }

    const response = await request(app).post(BASE_ROLES_URL).send(newRoleData)

    const body = (mockRoleController.create as jest.Mock).mock.calls[0][0].body
    expect(body).toBeDefined()
    expect(mockRoleController.create).toHaveBeenCalled()
    expect(body).toStrictEqual(newRoleData)
    expect(response.status).toBe(StatusCodes.CREATED)
  })

  it('update route PATCH /roles/:id can be called', async () => {
    const id = '1'
    const endPoint = `${BASE_ROLES_URL}/${id}`
    const updateRoleData = { id, name: 'Updated Role' }

    const response = await request(app).patch(endPoint).send(updateRoleData)

    const reqArg = (mockRoleController.update as jest.Mock).mock.calls[0][0]
    expect(reqArg.originalUrl).toBe(endPoint)
    expect(reqArg.body).toStrictEqual(updateRoleData)
    expect(mockRoleController.update).toHaveBeenCalled()
    expect(response.status).toBe(StatusCodes.OK)
  })

  it('delete route DELETE /roles/:id can be called', async () => {
    const id = '1'
    const endPoint = `${BASE_ROLES_URL}/${id}`

    const response = await request(app).delete(endPoint)

    const reqArg = (mockRoleController.delete as jest.Mock).mock.calls[0][0]
    expect(reqArg.originalUrl).toBe(endPoint)
    expect(mockRoleController.delete).toHaveBeenCalled()
    expect(response.status).toBe(StatusCodes.OK)
    expect(response.body).toEqual({ id })
  })
})
