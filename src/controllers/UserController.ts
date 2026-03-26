import { validate } from 'class-validator'
import type { Request, Response } from 'express'
import { StatusCodes } from 'http-status-codes'
import type { Repository } from 'typeorm'
import { User } from '../entities/User.entity.ts'
import { ResponseHandler } from '../helpers/ResponseHandler.ts'

export class UserController {
  constructor(private readonly userRepository: Repository<User>) {}

  public getAll = async (_req: Request, res: Response): Promise<void> => {
    try {
      const users = await this.userRepository.find()

      if (users.length === 0) {
        ResponseHandler.sendErrorResponse(res, StatusCodes.NO_CONTENT)
        return
      }

      ResponseHandler.sendSuccessResponse(res, users)
    } catch (error) {
      ResponseHandler.sendErrorResponse(
        res,
        StatusCodes.INTERNAL_SERVER_ERROR,
        'Failed to retrieve users'
      )
    }
  }

  public getById = async (req: Request, res: Response): Promise<void> => {
    const id = parseInt(req.params.id as string)

    if (isNaN(id)) {
      ResponseHandler.sendErrorResponse(res, StatusCodes.BAD_REQUEST, 'Invalid ID format')
      return
    }

    try {
      const user = await this.userRepository.findOne({ where: { id } })

      if (!user) {
        ResponseHandler.sendErrorResponse(
          res,
          StatusCodes.NOT_FOUND,
          `User not found with ID: ${id}`
        )
        return
      }

      ResponseHandler.sendSuccessResponse(res, user)
    } catch (error) {
      ResponseHandler.sendErrorResponse(
        res,
        StatusCodes.INTERNAL_SERVER_ERROR,
        'Failed to retrieve user'
      )
    }
  }

  public create = async (req: Request, res: Response): Promise<void> => {
    try {
      const user = new User()
      Object.assign(user, req.body)

      const errors = await validate(user)
      if (errors.length > 0) {
        throw new Error(errors.map((err) => Object.values(err.constraints || {})).join(', '))
      }

      const newUser = await this.userRepository.save(user)
      ResponseHandler.sendSuccessResponse(res, newUser, StatusCodes.CREATED)
    } catch (error: any) {
      ResponseHandler.sendErrorResponse(res, StatusCodes.BAD_REQUEST, error.message)
    }
  }

  public update = async (req: Request, res: Response): Promise<void> => {
    const id = parseInt(req.params.id as string)

    if (isNaN(id)) {
      ResponseHandler.sendErrorResponse(res, StatusCodes.BAD_REQUEST, 'Invalid ID format')
      return
    }

    try {
      const user = await this.userRepository.findOneBy({ id })

      if (!user) {
        ResponseHandler.sendErrorResponse(res, StatusCodes.NOT_FOUND, 'User not found')
        return
      }

      Object.assign(user, req.body)

      const errors = await validate(user)
      if (errors.length > 0) {
        throw new Error(errors.map((err) => Object.values(err.constraints || {})).join(', '))
      }

      const updatedUser = await this.userRepository.save(user)
      ResponseHandler.sendSuccessResponse(res, updatedUser)
    } catch (error: any) {
      ResponseHandler.sendErrorResponse(res, StatusCodes.BAD_REQUEST, error.message)
    }
  }

  public delete = async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id as string

    try {
      if (!id) {
        ResponseHandler.sendErrorResponse(res, StatusCodes.BAD_REQUEST, 'No ID provided')
        return
      }

      const result = await this.userRepository.delete(id)

      if (result.affected === 0) {
        ResponseHandler.sendErrorResponse(res, StatusCodes.NOT_FOUND, 'User not found')
        return
      }

      ResponseHandler.sendSuccessResponse(res, 'User deleted')
    } catch (error: any) {
      ResponseHandler.sendErrorResponse(res, StatusCodes.NOT_FOUND, error.message)
    }
  }
}
