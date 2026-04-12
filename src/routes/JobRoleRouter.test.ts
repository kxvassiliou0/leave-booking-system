import request from 'supertest'
import express, { Router } from 'express'
import { JobRoleRouter } from './JobRoleRouter'
import { JobRoleController } from '../controllers/JobRoleController'
import { StatusCodes } from 'http-status-codes'

const mockJobRoleController = {
  delete: jest.fn((req, res) => res.status(StatusCodes.OK).json({ id: req.params.id })),
  getAll: jest.fn((_req, res) => res.status(StatusCodes.OK).json([])),
  getById: jest.fn((req, res) => res.status(StatusCodes.OK).json({ id: req.params.id })),
  create: jest.fn((req, res) => res.status(StatusCodes.CREATED).json(req.body)),
  update: jest.fn((req, res) => res.status(StatusCodes.OK).json(req.body)),
} as unknown as JobRoleController

const router = Router()
jest.spyOn(router, 'get')
jest.spyOn(router, 'post')
jest.spyOn(router, 'patch')
jest.spyOn(router, 'delete')

const app = express()
app.use(express.json())
app.use((req, _res, next) => {
  ;(req as any).signedInUser = { token: { email: 'admin@test.com', role: 'Admin' } }
  next()
})

const jobRoleRouter = new JobRoleRouter(router, mockJobRoleController)
app.use('/job-roles', jobRoleRouter.getRouter())

const BASE_URL = '/job-roles'

describe('JobRoleRouter', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('getAll on GET /job-roles can be called', async () => {
    const response = await request(app).get(BASE_URL)

    expect(mockJobRoleController.getAll).toHaveBeenCalled()
    expect(response.status).toBe(StatusCodes.OK)
    expect(response.body).toEqual([])
  })

  it('getById route GET /job-roles/:id can be called', async () => {
    const id = '1'
    const endPoint = `${BASE_URL}/${id}`

    const response = await request(app).get(endPoint)

    const reqArg = (mockJobRoleController.getById as jest.Mock).mock.calls[0][0]
    expect(reqArg.originalUrl).toBe(endPoint)
    expect(response.status).toBe(StatusCodes.OK)
    expect(response.body).toEqual({ id })
  })

  it('create route POST /job-roles can be called', async () => {
    const newJobRoleData = { name: 'Senior Contractor' }

    const response = await request(app).post(BASE_URL).send(newJobRoleData)

    const body = (mockJobRoleController.create as jest.Mock).mock.calls[0][0].body
    expect(body).toBeDefined()
    expect(mockJobRoleController.create).toHaveBeenCalled()
    expect(body).toStrictEqual(newJobRoleData)
    expect(response.status).toBe(StatusCodes.CREATED)
  })

  it('update route PATCH /job-roles/:id can be called', async () => {
    const id = '1'
    const endPoint = `${BASE_URL}/${id}`
    const updateData = { id, name: 'Lead Engineer' }

    const response = await request(app).patch(endPoint).send(updateData)

    const reqArg = (mockJobRoleController.update as jest.Mock).mock.calls[0][0]
    expect(reqArg.originalUrl).toBe(endPoint)
    expect(reqArg.body).toStrictEqual(updateData)
    expect(mockJobRoleController.update).toHaveBeenCalled()
    expect(response.status).toBe(StatusCodes.OK)
  })

  it('delete route DELETE /job-roles/:id can be called', async () => {
    const id = '1'
    const endPoint = `${BASE_URL}/${id}`

    const response = await request(app).delete(endPoint)

    const reqArg = (mockJobRoleController.delete as jest.Mock).mock.calls[0][0]
    expect(reqArg.originalUrl).toBe(endPoint)
    expect(mockJobRoleController.delete).toHaveBeenCalled()
    expect(response.status).toBe(StatusCodes.OK)
    expect(response.body).toEqual({ id })
  })
})
