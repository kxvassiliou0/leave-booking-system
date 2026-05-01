import type { Request, Response } from 'express'
import { StatusCodes } from 'http-status-codes'
import { mock } from 'jest-mock-extended'
import type { Repository, SelectQueryBuilder } from 'typeorm'
import { LoginController } from './LoginController'
import { User } from '../entities/User.entity'
import { PasswordHandler } from '../helpers/PasswordHandler'
import { ResponseHandler } from '../helpers/ResponseHandler'

jest.mock('../helpers/ResponseHandler')
jest.mock('../helpers/Logger')

function mockRequest(body: Record<string, unknown> = {}): Request {
  return { body } as unknown as Request
}

function mockResponse(): Response {
  const res = {} as Response
  res.status = jest.fn().mockReturnValue(res)
  res.send = jest.fn().mockReturnValue(res)
  res.json = jest.fn().mockReturnValue(res)
  return res
}

function makeUser(overrides: Partial<User> = {}): User {
  return Object.assign(new User(), {
    id: 1,
    email: 'alice@company.com',
    password: 'hashed',
    salt: 'somesalt',
    role: 'Employee',
    ...overrides,
  })
}

describe('LoginController', () => {
  let userRepository: ReturnType<typeof mock<Repository<User>>>
  let controller: LoginController
  let qb: ReturnType<typeof mock<SelectQueryBuilder<User>>>

  beforeEach(() => {
    jest.clearAllMocks()
    userRepository = mock<Repository<User>>()
    controller = new LoginController(userRepository)

    qb = mock<SelectQueryBuilder<User>>()
    qb.addSelect.mockReturnValue(qb)
    qb.where.mockReturnValue(qb)
    qb.getOne.mockResolvedValue(null)
    userRepository.createQueryBuilder.mockReturnValue(qb)
  })

  describe('login', () => {
    it('returns BAD_REQUEST when email is missing', async () => {
      const req = mockRequest({ password: 'secret' })
      const res = mockResponse()

      await controller.login(req, res)

      expect(ResponseHandler.sendErrorResponse).toHaveBeenCalledWith(
        res,
        StatusCodes.BAD_REQUEST,
        'Email and password are required'
      )
    })

    it('returns BAD_REQUEST when password is missing', async () => {
      const req = mockRequest({ email: 'alice@company.com' })
      const res = mockResponse()

      await controller.login(req, res)

      expect(ResponseHandler.sendErrorResponse).toHaveBeenCalledWith(
        res,
        StatusCodes.BAD_REQUEST,
        'Email and password are required'
      )
    })

    it('returns UNAUTHORIZED when user is not found', async () => {
      qb.getOne.mockResolvedValue(null)
      const req = mockRequest({ email: 'nobody@company.com', password: 'pass' })
      const res = mockResponse()

      await controller.login(req, res)

      expect(ResponseHandler.sendErrorResponse).toHaveBeenCalledWith(
        res,
        StatusCodes.UNAUTHORIZED,
        LoginController.ERROR_USER_NOT_FOUND
      )
    })

    it('returns UNAUTHORIZED when password is incorrect', async () => {
      qb.getOne.mockResolvedValue(makeUser())
      jest.spyOn(PasswordHandler, 'verifyPassword').mockReturnValue(false)
      const req = mockRequest({ email: 'alice@company.com', password: 'wrong' })
      const res = mockResponse()

      await controller.login(req, res)

      expect(ResponseHandler.sendErrorResponse).toHaveBeenCalledWith(
        res,
        StatusCodes.UNAUTHORIZED,
        LoginController.ERROR_PASSWORD_INCORRECT
      )
    })

    it('returns ACCEPTED with a JWT when credentials are valid', async () => {
      qb.getOne.mockResolvedValue(makeUser())
      jest.spyOn(PasswordHandler, 'verifyPassword').mockReturnValue(true)
      process.env.JWT_SECRET_KEY = 'test-secret'
      const req = mockRequest({ email: 'alice@company.com', password: 'correct' })
      const res = mockResponse()

      await controller.login(req, res)

      expect(res.status).toHaveBeenCalledWith(StatusCodes.ACCEPTED)
      expect(res.send).toHaveBeenCalledWith(expect.any(String))
    })
  })
})
