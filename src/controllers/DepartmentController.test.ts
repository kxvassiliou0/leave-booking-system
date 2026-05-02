import type { Request, Response } from 'express'
import { StatusCodes } from 'http-status-codes'
import { mock } from 'jest-mock-extended'
import type { Repository } from 'typeorm'
import { DepartmentController } from './DepartmentController'
import { Department } from '../entities/Department.entity'
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

function makeDepartment(overrides: Partial<Department> = {}): Department {
  return Object.assign(new Department(), { id: 1, name: 'Engineering', ...overrides })
}

describe('DepartmentController', () => {
  let departmentRepository: ReturnType<typeof mock<Repository<Department>>>
  let controller: DepartmentController

  beforeEach(() => {
    jest.clearAllMocks()
    ;(validate as jest.Mock).mockResolvedValue([])
    departmentRepository = mock<Repository<Department>>()
    controller = new DepartmentController(departmentRepository)
  })

  describe('getAll', () => {
    it('returns OK with all departments', async () => {
      const departments = [makeDepartment(), makeDepartment({ id: 2, name: 'HR' })]
      departmentRepository.find.mockResolvedValue(departments)
      const req = mockRequest()
      const res = mockResponse()

      await controller.getAll(req, res)

      expect(ResponseHandler.sendSuccessResponse).toHaveBeenCalledWith(res, departments)
    })

    it('returns NO_CONTENT when list is empty', async () => {
      departmentRepository.find.mockResolvedValue([])
      const req = mockRequest()
      const res = mockResponse()

      await controller.getAll(req, res)

      expect(ResponseHandler.sendErrorResponse).toHaveBeenCalledWith(res, StatusCodes.NO_CONTENT)
    })

    it('returns INTERNAL_SERVER_ERROR on repository error', async () => {
      departmentRepository.find.mockRejectedValue(new Error('db error'))
      const req = mockRequest()
      const res = mockResponse()

      await controller.getAll(req, res)

      expect(ResponseHandler.sendErrorResponse).toHaveBeenCalledWith(
        res,
        StatusCodes.INTERNAL_SERVER_ERROR,
        'Failed to retrieve departments'
      )
    })
  })

  describe('getById', () => {
    it('returns OK with the department', async () => {
      const department = makeDepartment()
      departmentRepository.findOne.mockResolvedValue(department)
      const req = mockRequest({ id: '1' })
      const res = mockResponse()

      await controller.getById(req, res)

      expect(ResponseHandler.sendSuccessResponse).toHaveBeenCalledWith(res, department)
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

    it('returns NOT_FOUND when department does not exist', async () => {
      departmentRepository.findOne.mockResolvedValue(null)
      const req = mockRequest({ id: '99' })
      const res = mockResponse()

      await controller.getById(req, res)

      expect(ResponseHandler.sendErrorResponse).toHaveBeenCalledWith(
        res,
        StatusCodes.NOT_FOUND,
        'Department not found with ID: 99'
      )
    })

    it('returns INTERNAL_SERVER_ERROR on repository error', async () => {
      departmentRepository.findOne.mockRejectedValue(new Error('db error'))
      const req = mockRequest({ id: '1' })
      const res = mockResponse()

      await controller.getById(req, res)

      expect(ResponseHandler.sendErrorResponse).toHaveBeenCalledWith(
        res,
        StatusCodes.INTERNAL_SERVER_ERROR,
        'Failed to retrieve department'
      )
    })
  })

  describe('create', () => {
    it('returns CREATED with the new department', async () => {
      const department = makeDepartment()
      departmentRepository.save.mockResolvedValue(department)
      const req = mockRequest({}, { name: 'Engineering' })
      const res = mockResponse()

      await controller.create(req, res)

      expect(ResponseHandler.sendSuccessResponse).toHaveBeenCalledWith(res, department, StatusCodes.CREATED)
    })

    it('returns UNPROCESSABLE_ENTITY when validate returns errors', async () => {
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
    it('returns OK with the updated department', async () => {
      const existing = makeDepartment()
      const updated = makeDepartment({ name: 'Product' })
      departmentRepository.findOneBy.mockResolvedValue(existing)
      departmentRepository.save.mockResolvedValue(updated)
      const req = mockRequest({ id: '1' }, { name: 'Product' })
      const res = mockResponse()

      await controller.update(req, res)

      expect(ResponseHandler.sendSuccessResponse).toHaveBeenCalledWith(res, updated)
    })

    it('returns BAD_REQUEST for non-numeric id', async () => {
      const req = mockRequest({ id: 'abc' }, { name: 'Product' })
      const res = mockResponse()

      await controller.update(req, res)

      expect(ResponseHandler.sendErrorResponse).toHaveBeenCalledWith(
        res,
        StatusCodes.BAD_REQUEST,
        'Invalid ID format'
      )
    })

    it('returns NOT_FOUND when department does not exist', async () => {
      departmentRepository.findOneBy.mockResolvedValue(null)
      const req = mockRequest({ id: '99' }, { name: 'Product' })
      const res = mockResponse()

      await controller.update(req, res)

      expect(ResponseHandler.sendErrorResponse).toHaveBeenCalledWith(
        res,
        StatusCodes.NOT_FOUND,
        'Department not found'
      )
    })

    it('returns UNPROCESSABLE_ENTITY when validate returns errors on update', async () => {
      departmentRepository.findOneBy.mockResolvedValue(makeDepartment())
      ;(validate as jest.Mock).mockResolvedValue([
        { constraints: { maxLength: 'name must be shorter than or equal to 100 characters' } },
      ])
      const req = mockRequest({ id: '1' }, { name: 'x'.repeat(101) })
      const res = mockResponse()

      await controller.update(req, res)

      expect(ResponseHandler.sendErrorResponse).toHaveBeenCalledWith(
        res,
        StatusCodes.UNPROCESSABLE_ENTITY,
        expect.stringContaining('name must be shorter than or equal to 100 characters')
      )
    })
  })

  describe('delete', () => {
    it('returns OK when department is deleted', async () => {
      departmentRepository.delete.mockResolvedValue({ affected: 1, raw: [] })
      const req = mockRequest({ id: '1' })
      const res = mockResponse()

      await controller.delete(req, res)

      expect(ResponseHandler.sendSuccessResponse).toHaveBeenCalledWith(res, 'Department deleted')
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
      departmentRepository.delete.mockResolvedValue({ affected: 0, raw: [] })
      const req = mockRequest({ id: '99' })
      const res = mockResponse()

      await controller.delete(req, res)

      expect(ResponseHandler.sendErrorResponse).toHaveBeenCalledWith(
        res,
        StatusCodes.NOT_FOUND,
        'Department not found'
      )
    })

    it('returns CONFLICT on foreign key constraint error', async () => {
      departmentRepository.delete.mockRejectedValue(new Error('foreign key constraint fails'))
      const req = mockRequest({ id: '1' })
      const res = mockResponse()

      await controller.delete(req, res)

      expect(ResponseHandler.sendErrorResponse).toHaveBeenCalledWith(
        res,
        StatusCodes.CONFLICT,
        'Cannot delete department: one or more users are assigned to it'
      )
    })

    it('returns INTERNAL_SERVER_ERROR on unexpected repository error', async () => {
      departmentRepository.delete.mockRejectedValue(new Error('unexpected db error'))
      const req = mockRequest({ id: '1' })
      const res = mockResponse()

      await controller.delete(req, res)

      expect(ResponseHandler.sendErrorResponse).toHaveBeenCalledWith(
        res,
        StatusCodes.INTERNAL_SERVER_ERROR,
        'Failed to delete department'
      )
    })
  })
})
