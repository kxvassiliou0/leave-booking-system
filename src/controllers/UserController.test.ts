import { StatusCodes } from 'http-status-codes'
import { mock } from 'jest-mock-extended'
import type { Repository } from 'typeorm'
import { UserController } from './UserController'
import { User } from '../entities/User.entity'
import { PasswordHandler } from '../helpers/PasswordHandler'
import { ResponseHandler } from '../helpers/ResponseHandler'
import { makeUser, mockRequest, mockResponse } from '../test/ObjectMother'

jest.mock('../helpers/ResponseHandler')
jest.mock('../helpers/Logger')
jest.mock('class-validator', () => ({
  ...jest.requireActual('class-validator'),
  validate: jest.fn().mockResolvedValue([]),
}))

import { validate } from 'class-validator'

describe('UserController', () => {
  let userRepository: ReturnType<typeof mock<Repository<User>>>
  let controller: UserController

  beforeEach(() => {
    jest.clearAllMocks()
    ;(validate as jest.Mock).mockResolvedValue([])
    userRepository = mock<Repository<User>>()
    controller = new UserController(userRepository)
  })

  describe('getAll', () => {
    it('returns OK with all users', async () => {
      // Arrange
      const users = [makeUser(), makeUser({ id: 2, email: 'bob@company.com' })]
      userRepository.find.mockResolvedValue(users)
      const req = mockRequest()
      const res = mockResponse()

      // Act
      await controller.getAll(req, res)

      // Assert
      expect(ResponseHandler.sendSuccessResponse).toHaveBeenCalledWith(res, users)
    })

    it('returns NO_CONTENT when list is empty', async () => {
      // Arrange
      userRepository.find.mockResolvedValue([])
      const req = mockRequest()
      const res = mockResponse()

      // Act
      await controller.getAll(req, res)

      // Assert
      expect(ResponseHandler.sendErrorResponse).toHaveBeenCalledWith(res, StatusCodes.NO_CONTENT)
    })

    it('returns INTERNAL_SERVER_ERROR on repository error', async () => {
      // Arrange
      userRepository.find.mockRejectedValue(new Error('db error'))
      const req = mockRequest()
      const res = mockResponse()

      // Act
      await controller.getAll(req, res)

      // Assert
      expect(ResponseHandler.sendErrorResponse).toHaveBeenCalledWith(
        res,
        StatusCodes.INTERNAL_SERVER_ERROR,
        'Failed to retrieve users'
      )
    })
  })

  describe('getById', () => {
    it('returns OK with the user', async () => {
      // Arrange
      const user = makeUser()
      userRepository.findOne.mockResolvedValue(user)
      const req = mockRequest({ id: '1' })
      const res = mockResponse()

      // Act
      await controller.getById(req, res)

      // Assert
      expect(ResponseHandler.sendSuccessResponse).toHaveBeenCalledWith(res, user)
    })

    it('returns BAD_REQUEST for non-numeric id', async () => {
      // Arrange
      const req = mockRequest({ id: 'abc' })
      const res = mockResponse()

      // Act
      await controller.getById(req, res)

      // Assert
      expect(ResponseHandler.sendErrorResponse).toHaveBeenCalledWith(
        res,
        StatusCodes.BAD_REQUEST,
        'Invalid ID format'
      )
    })

    it('returns NOT_FOUND when user does not exist', async () => {
      // Arrange
      userRepository.findOne.mockResolvedValue(null)
      const req = mockRequest({ id: '99' })
      const res = mockResponse()

      // Act
      await controller.getById(req, res)

      // Assert
      expect(ResponseHandler.sendErrorResponse).toHaveBeenCalledWith(
        res,
        StatusCodes.NOT_FOUND,
        'User not found with ID: 99'
      )
    })

    it('returns INTERNAL_SERVER_ERROR on repository error', async () => {
      // Arrange
      userRepository.findOne.mockRejectedValue(new Error('db error'))
      const req = mockRequest({ id: '1' })
      const res = mockResponse()

      // Act
      await controller.getById(req, res)

      // Assert
      expect(ResponseHandler.sendErrorResponse).toHaveBeenCalledWith(
        res,
        StatusCodes.INTERNAL_SERVER_ERROR,
        'Failed to retrieve user'
      )
    })
  })

  describe('create', () => {
    it('returns CREATED with the new user', async () => {
      // Arrange
      const saved = makeUser()
      userRepository.save.mockResolvedValue(saved)
      userRepository.findOneBy.mockResolvedValue(saved)
      const req = mockRequest({}, { firstName: 'Alice', email: 'alice@company.com' })
      const res = mockResponse()

      // Act
      await controller.create(req, res)

      // Assert
      expect(ResponseHandler.sendSuccessResponse).toHaveBeenCalledWith(res, saved, StatusCodes.CREATED)
    })

    it('returns UNPROCESSABLE_ENTITY when validate returns errors', async () => {
      // Arrange
      ;(validate as jest.Mock).mockResolvedValue([
        { constraints: { minLength: 'Password must be at least 10 characters long' } },
      ])
      const req = mockRequest({}, { password: 'short' })
      const res = mockResponse()

      // Act
      await controller.create(req, res)

      // Assert
      expect(ResponseHandler.sendErrorResponse).toHaveBeenCalledWith(
        res,
        StatusCodes.UNPROCESSABLE_ENTITY,
        expect.stringContaining('Password must be at least 10 characters long')
      )
    })
  })

  describe('update', () => {
    it('returns OK with updated user when no password change', async () => {
      // Arrange
      const existing = makeUser()
      const updated = makeUser({ firstName: 'Alicia' })
      userRepository.findOneBy.mockResolvedValueOnce(existing).mockResolvedValueOnce(updated)
      userRepository.save.mockResolvedValue(updated)
      const req = mockRequest({ id: '1' }, { firstName: 'Alicia' })
      const res = mockResponse()

      // Act
      await controller.update(req, res)

      // Assert
      expect(ResponseHandler.sendSuccessResponse).toHaveBeenCalledWith(res, updated)
    })

    it('re-hashes password when password field is present in body', async () => {
      // Arrange
      const existing = makeUser()
      const updated = makeUser()
      userRepository.findOneBy.mockResolvedValueOnce(existing).mockResolvedValueOnce(updated)
      userRepository.save.mockResolvedValue(updated)
      jest.spyOn(PasswordHandler, 'hashPassword').mockReturnValue({
        hashedPassword: 'newHash',
        salt: 'newSalt',
      })
      const req = mockRequest({ id: '1' }, { password: 'NewPassword1!' })
      const res = mockResponse()

      // Act
      await controller.update(req, res)

      // Assert
      expect(PasswordHandler.hashPassword).toHaveBeenCalledWith('NewPassword1!')
      expect(ResponseHandler.sendSuccessResponse).toHaveBeenCalledWith(res, updated)
    })

    it('returns BAD_REQUEST for non-numeric id', async () => {
      // Arrange
      const req = mockRequest({ id: 'abc' }, { firstName: 'x' })
      const res = mockResponse()

      // Act
      await controller.update(req, res)

      // Assert
      expect(ResponseHandler.sendErrorResponse).toHaveBeenCalledWith(
        res,
        StatusCodes.BAD_REQUEST,
        'Invalid ID format'
      )
    })

    it('returns NOT_FOUND when user does not exist', async () => {
      // Arrange
      userRepository.findOneBy.mockResolvedValue(null)
      const req = mockRequest({ id: '99' }, { firstName: 'x' })
      const res = mockResponse()

      // Act
      await controller.update(req, res)

      // Assert
      expect(ResponseHandler.sendErrorResponse).toHaveBeenCalledWith(
        res,
        StatusCodes.NOT_FOUND,
        'User not found'
      )
    })
  })

  describe('delete', () => {
    it('returns OK when user is deleted', async () => {
      // Arrange
      userRepository.delete.mockResolvedValue({ affected: 1, raw: [] })
      const req = mockRequest({ id: '1' })
      const res = mockResponse()

      // Act
      await controller.delete(req, res)

      // Assert
      expect(ResponseHandler.sendSuccessResponse).toHaveBeenCalledWith(res, 'User deleted')
    })

    it('returns NOT_FOUND when no rows affected', async () => {
      // Arrange
      userRepository.delete.mockResolvedValue({ affected: 0, raw: [] })
      const req = mockRequest({ id: '99' })
      const res = mockResponse()

      // Act
      await controller.delete(req, res)

      // Assert
      expect(ResponseHandler.sendErrorResponse).toHaveBeenCalledWith(
        res,
        StatusCodes.NOT_FOUND,
        'User not found'
      )
    })
  })
})
