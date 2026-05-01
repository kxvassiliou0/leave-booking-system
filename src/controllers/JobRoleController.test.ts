import type { Request, Response } from 'express'
import { StatusCodes } from 'http-status-codes'
import { mock } from 'jest-mock-extended'
import type { Repository } from 'typeorm'
import { JobRoleController } from './JobRoleController'
import { JobRole } from '../entities/JobRole.entity'
import { ResponseHandler } from '../helpers/ResponseHandler'

jest.mock('../helpers/ResponseHandler')
jest.mock('../helpers/Logger')
jest.mock('class-validator', () => ({
  ...jest.requireActual('class-validator'),
  validate: jest.fn().mockResolvedValue([]),
}))

import { validate } from 'class-validator'

function mockRequest(params: Record<string, string> = {}, body: Record<string, unknown> = {}): Request {
  return { params, body } as unknown as Request
}

function mockResponse(): Response {
  const res = {} as Response
  res.status = jest.fn().mockReturnValue(res)
  res.json = jest.fn().mockReturnValue(res)
  return res
}

function makeJobRole(overrides: Partial<JobRole> = {}): JobRole {
  return Object.assign(new JobRole(), { id: 1, name: 'Contractor', ...overrides })
}

describe('JobRoleController', () => {
  let jobRoleRepository: ReturnType<typeof mock<Repository<JobRole>>>
  let controller: JobRoleController

  beforeEach(() => {
    jest.clearAllMocks()
    ;(validate as jest.Mock).mockResolvedValue([])
    jobRoleRepository = mock<Repository<JobRole>>()
    controller = new JobRoleController(jobRoleRepository)
  })

  describe('getAll', () => {
    it('returns OK with all job roles', async () => {
      const roles = [makeJobRole(), makeJobRole({ id: 2, name: 'Senior Contractor' })]
      jobRoleRepository.find.mockResolvedValue(roles)
      const req = mockRequest()
      const res = mockResponse()

      await controller.getAll(req, res)

      expect(ResponseHandler.sendSuccessResponse).toHaveBeenCalledWith(res, roles)
    })

    it('returns NO_CONTENT when list is empty', async () => {
      jobRoleRepository.find.mockResolvedValue([])
      const req = mockRequest()
      const res = mockResponse()

      await controller.getAll(req, res)

      expect(ResponseHandler.sendErrorResponse).toHaveBeenCalledWith(res, StatusCodes.NO_CONTENT)
    })

    it('returns INTERNAL_SERVER_ERROR on repository error', async () => {
      jobRoleRepository.find.mockRejectedValue(new Error('db error'))
      const req = mockRequest()
      const res = mockResponse()

      await controller.getAll(req, res)

      expect(ResponseHandler.sendErrorResponse).toHaveBeenCalledWith(
        res,
        StatusCodes.INTERNAL_SERVER_ERROR,
        'Failed to retrieve job roles'
      )
    })
  })

  describe('getById', () => {
    it('returns OK with the job role', async () => {
      const role = makeJobRole()
      jobRoleRepository.findOne.mockResolvedValue(role)
      const req = mockRequest({ id: '1' })
      const res = mockResponse()

      await controller.getById(req, res)

      expect(ResponseHandler.sendSuccessResponse).toHaveBeenCalledWith(res, role)
    })

    it('returns BAD_REQUEST for non-numeric id', async () => {
      const req = mockRequest({ id: 'abc' })
      const res = mockResponse()

      await controller.getById(req, res)

      expect(ResponseHandler.sendErrorResponse).toHaveBeenCalledWith(
        res,
        StatusCodes.BAD_REQUEST,
        'Invalid ID format'
      )
    })

    it('returns NOT_FOUND when role does not exist', async () => {
      jobRoleRepository.findOne.mockResolvedValue(null)
      const req = mockRequest({ id: '99' })
      const res = mockResponse()

      await controller.getById(req, res)

      expect(ResponseHandler.sendErrorResponse).toHaveBeenCalledWith(
        res,
        StatusCodes.NOT_FOUND,
        'Job role not found with ID: 99'
      )
    })

    it('returns INTERNAL_SERVER_ERROR on repository error', async () => {
      jobRoleRepository.findOne.mockRejectedValue(new Error('db error'))
      const req = mockRequest({ id: '1' })
      const res = mockResponse()

      await controller.getById(req, res)

      expect(ResponseHandler.sendErrorResponse).toHaveBeenCalledWith(
        res,
        StatusCodes.INTERNAL_SERVER_ERROR,
        'Failed to retrieve job role'
      )
    })
  })

  describe('create', () => {
    it('returns CREATED with the new job role', async () => {
      const role = makeJobRole()
      jobRoleRepository.save.mockResolvedValue(role)
      const req = mockRequest({}, { name: 'Contractor' })
      const res = mockResponse()

      await controller.create(req, res)

      expect(ResponseHandler.sendSuccessResponse).toHaveBeenCalledWith(res, role, StatusCodes.CREATED)
    })

    it('returns BAD_REQUEST when validate returns errors', async () => {
      ;(validate as jest.Mock).mockResolvedValue([
        { constraints: { isNotEmpty: 'name should not be empty' } },
      ])
      const req = mockRequest({}, { name: '' })
      const res = mockResponse()

      await controller.create(req, res)

      expect(ResponseHandler.sendErrorResponse).toHaveBeenCalledWith(
        res,
        StatusCodes.UNPROCESSABLE_ENTITY,
        expect.stringContaining('name should not be empty')
      )
    })
  })

  describe('update', () => {
    it('returns OK with the updated job role', async () => {
      const existing = makeJobRole()
      const updated = makeJobRole({ name: 'Lead Engineer' })
      jobRoleRepository.findOneBy.mockResolvedValue(existing)
      jobRoleRepository.save.mockResolvedValue(updated)
      const req = mockRequest({ id: '1' }, { name: 'Lead Engineer' })
      const res = mockResponse()

      await controller.update(req, res)

      expect(ResponseHandler.sendSuccessResponse).toHaveBeenCalledWith(res, updated)
    })

    it('returns BAD_REQUEST for non-numeric id', async () => {
      const req = mockRequest({ id: 'abc' }, { name: 'x' })
      const res = mockResponse()

      await controller.update(req, res)

      expect(ResponseHandler.sendErrorResponse).toHaveBeenCalledWith(
        res,
        StatusCodes.BAD_REQUEST,
        'Invalid ID format'
      )
    })

    it('returns NOT_FOUND when role does not exist', async () => {
      jobRoleRepository.findOneBy.mockResolvedValue(null)
      const req = mockRequest({ id: '99' }, { name: 'x' })
      const res = mockResponse()

      await controller.update(req, res)

      expect(ResponseHandler.sendErrorResponse).toHaveBeenCalledWith(
        res,
        StatusCodes.NOT_FOUND,
        'Job role not found'
      )
    })
  })

  describe('delete', () => {
    it('returns OK when role is deleted', async () => {
      jobRoleRepository.delete.mockResolvedValue({ affected: 1, raw: [] })
      const req = mockRequest({ id: '1' })
      const res = mockResponse()

      await controller.delete(req, res)

      expect(ResponseHandler.sendSuccessResponse).toHaveBeenCalledWith(res, 'Job role deleted')
    })

    it('returns BAD_REQUEST when no id provided', async () => {
      const req = mockRequest({ id: '' })
      const res = mockResponse()

      await controller.delete(req, res)

      expect(ResponseHandler.sendErrorResponse).toHaveBeenCalledWith(
        res,
        StatusCodes.BAD_REQUEST,
        'No ID provided'
      )
    })

    it('returns NOT_FOUND when no rows affected', async () => {
      jobRoleRepository.delete.mockResolvedValue({ affected: 0, raw: [] })
      const req = mockRequest({ id: '99' })
      const res = mockResponse()

      await controller.delete(req, res)

      expect(ResponseHandler.sendErrorResponse).toHaveBeenCalledWith(
        res,
        StatusCodes.NOT_FOUND,
        'Job role not found'
      )
    })

    it('returns CONFLICT on foreign key constraint error', async () => {
      jobRoleRepository.delete.mockRejectedValue(new Error('foreign key constraint fails'))
      const req = mockRequest({ id: '1' })
      const res = mockResponse()

      await controller.delete(req, res)

      expect(ResponseHandler.sendErrorResponse).toHaveBeenCalledWith(
        res,
        StatusCodes.CONFLICT,
        'Cannot delete job role: one or more users are assigned to it'
      )
    })

    it('returns INTERNAL_SERVER_ERROR on unexpected repository error', async () => {
      jobRoleRepository.delete.mockRejectedValue(new Error('unexpected db error'))
      const req = mockRequest({ id: '1' })
      const res = mockResponse()

      await controller.delete(req, res)

      expect(ResponseHandler.sendErrorResponse).toHaveBeenCalledWith(
        res,
        StatusCodes.INTERNAL_SERVER_ERROR,
        'Failed to delete job role'
      )
    })
  })
})
