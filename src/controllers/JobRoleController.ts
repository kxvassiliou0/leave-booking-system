import { validate } from 'class-validator'
import type { Request, Response } from 'express'
import { StatusCodes } from 'http-status-codes'
import type { Repository } from 'typeorm'
import { JobRole } from '../entities/JobRole.entity.ts'
import { AppError } from '../helpers/AppError.ts'
import { Logger } from '../helpers/Logger.ts'
import { ResponseHandler } from '../helpers/ResponseHandler.ts'
import type { IEntityController } from '../types/IEntityController.ts'

export class JobRoleController implements IEntityController {
  constructor(private readonly jobRoleRepository: Repository<JobRole>) {}

  public getAll = async (_req: Request, res: Response): Promise<void> => {
    try {
      const jobRoles = await this.jobRoleRepository.find()

      if (jobRoles.length === 0) {
        ResponseHandler.sendErrorResponse(res, StatusCodes.NO_CONTENT)
        return
      }

      ResponseHandler.sendSuccessResponse(res, jobRoles)
    } catch (error) {
      Logger.error('Unexpected error in JobRoleController.getAll', {
        error: error instanceof Error ? error.message : String(error),
      })
      ResponseHandler.sendErrorResponse(
        res,
        StatusCodes.INTERNAL_SERVER_ERROR,
        'Failed to retrieve job roles'
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
      const jobRole = await this.jobRoleRepository.findOne({ where: { id } })

      if (!jobRole) {
        ResponseHandler.sendErrorResponse(
          res,
          StatusCodes.NOT_FOUND,
          `Job role not found with ID: ${id}`
        )
        return
      }

      ResponseHandler.sendSuccessResponse(res, jobRole)
    } catch (error) {
      Logger.error('Unexpected error in JobRoleController.getById', {
        error: error instanceof Error ? error.message : String(error),
      })
      ResponseHandler.sendErrorResponse(
        res,
        StatusCodes.INTERNAL_SERVER_ERROR,
        'Failed to retrieve job role'
      )
    }
  }

  public create = async (req: Request, res: Response): Promise<void> => {
    try {
      const jobRole = new JobRole()
      jobRole.name = req.body.name

      const errors = await validate(jobRole)
      if (errors.length > 0) {
        throw new AppError(
          errors.map((err) => Object.values(err.constraints || {})).join(', '),
          StatusCodes.UNPROCESSABLE_ENTITY
        )
      }

      const newJobRole = await this.jobRoleRepository.save(jobRole)
      ResponseHandler.sendSuccessResponse(res, newJobRole, StatusCodes.CREATED)
    } catch (error) {
      const statusCode = error instanceof AppError ? error.statusCode : StatusCodes.BAD_REQUEST
      const message = error instanceof Error ? error.message : 'Bad request'
      ResponseHandler.sendErrorResponse(res, statusCode, message)
    }
  }

  public update = async (req: Request, res: Response): Promise<void> => {
    const id = parseInt(req.params.id as string)
    const name = req.body.name

    if (isNaN(id)) {
      ResponseHandler.sendErrorResponse(res, StatusCodes.BAD_REQUEST, 'Invalid ID format')
      return
    }

    try {
      const jobRole = await this.jobRoleRepository.findOneBy({ id })

      if (!jobRole) {
        ResponseHandler.sendErrorResponse(res, StatusCodes.NOT_FOUND, 'Job role not found')
        return
      }

      if (name !== undefined) jobRole.name = name

      const errors = await validate(jobRole)
      if (errors.length > 0) {
        throw new AppError(
          errors.map((err) => Object.values(err.constraints || {})).join(', '),
          StatusCodes.UNPROCESSABLE_ENTITY
        )
      }

      const updatedJobRole = await this.jobRoleRepository.save(jobRole)
      ResponseHandler.sendSuccessResponse(res, updatedJobRole)
    } catch (error) {
      const statusCode = error instanceof AppError ? error.statusCode : StatusCodes.BAD_REQUEST
      const message = error instanceof Error ? error.message : 'Bad request'
      ResponseHandler.sendErrorResponse(res, statusCode, message)
    }
  }

  public delete = async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id

    if (!id) {
      ResponseHandler.sendErrorResponse(res, StatusCodes.BAD_REQUEST, 'No ID provided')
      return
    }

    try {
      const result = await this.jobRoleRepository.delete(id)

      if (result.affected === 0) {
        ResponseHandler.sendErrorResponse(res, StatusCodes.NOT_FOUND, 'Job role not found')
        return
      }

      ResponseHandler.sendSuccessResponse(res, 'Job role deleted')
    } catch (error) {
      if (error instanceof Error && error.message.includes('foreign key constraint')) {
        ResponseHandler.sendErrorResponse(
          res,
          StatusCodes.CONFLICT,
          'Cannot delete job role: one or more users are assigned to it'
        )
        return
      }

      Logger.error('Unexpected error in JobRoleController.delete', {
        error: error instanceof Error ? error.message : String(error),
      })
      ResponseHandler.sendErrorResponse(
        res,
        StatusCodes.INTERNAL_SERVER_ERROR,
        'Failed to delete job role'
      )
    }
  }
}
