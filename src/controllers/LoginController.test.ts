import { StatusCodes } from 'http-status-codes'
import { mock } from 'jest-mock-extended'
import type { Repository, SelectQueryBuilder } from 'typeorm'
import { LoginController } from './LoginController'
import { User } from '../entities/User.entity'
import { PasswordHandler } from '../helpers/PasswordHandler'
import { ResponseHandler } from '../helpers/ResponseHandler'
import { makeUser, mockRequest, mockResponse } from '../test/ObjectMother'
import { TEST_JWT_SECRET } from '../test/testConfig'

jest.mock('../helpers/ResponseHandler')
jest.mock('../helpers/Logger')

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
      // Arrange
      const req = mockRequest({}, { password: 'secret' })
      const res = mockResponse()

      // Act
      await controller.login(req, res)

      // Assert
      expect(ResponseHandler.sendErrorResponse).toHaveBeenCalledWith(
        res,
        StatusCodes.BAD_REQUEST,
        'Email and password are required'
      )
    })

    it('returns BAD_REQUEST when password is missing', async () => {
      // Arrange
      const req = mockRequest({}, { email: 'alice@company.com' })
      const res = mockResponse()

      // Act
      await controller.login(req, res)

      // Assert
      expect(ResponseHandler.sendErrorResponse).toHaveBeenCalledWith(
        res,
        StatusCodes.BAD_REQUEST,
        'Email and password are required'
      )
    })

    it('returns UNAUTHORIZED when user is not found', async () => {
      // Arrange
      qb.getOne.mockResolvedValue(null)
      const req = mockRequest({}, { email: 'nobody@company.com', password: 'pass' })
      const res = mockResponse()

      // Act
      await controller.login(req, res)

      // Assert
      expect(ResponseHandler.sendErrorResponse).toHaveBeenCalledWith(
        res,
        StatusCodes.UNAUTHORIZED,
        LoginController.ERROR_USER_NOT_FOUND
      )
    })

    it('returns UNAUTHORIZED when password is incorrect', async () => {
      // Arrange
      qb.getOne.mockResolvedValue(makeUser())
      jest.spyOn(PasswordHandler, 'verifyPassword').mockReturnValue(false)
      const req = mockRequest({}, { email: 'alice@company.com', password: 'wrong' })
      const res = mockResponse()

      // Act
      await controller.login(req, res)

      // Assert
      expect(ResponseHandler.sendErrorResponse).toHaveBeenCalledWith(
        res,
        StatusCodes.UNAUTHORIZED,
        LoginController.ERROR_PASSWORD_INCORRECT
      )
    })

    it('returns ACCEPTED with a JWT when credentials are valid', async () => {
      // Arrange
      qb.getOne.mockResolvedValue(makeUser())
      jest.spyOn(PasswordHandler, 'verifyPassword').mockReturnValue(true)
      process.env.JWT_SECRET_KEY = TEST_JWT_SECRET
      const req = mockRequest({}, { email: 'alice@company.com', password: 'correct' })
      const res = mockResponse()

      // Act
      await controller.login(req, res)

      // Assert
      expect(res.status).toHaveBeenCalledWith(StatusCodes.ACCEPTED)
      expect(res.send).toHaveBeenCalledWith(expect.any(String))
    })
  })
})
