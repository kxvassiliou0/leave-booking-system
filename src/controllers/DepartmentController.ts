import { validate } from 'class-validator'
import type { Request, Response } from 'express'
import { StatusCodes } from 'http-status-codes'
import type { Repository } from 'typeorm'
import { Department } from '../entities/Department.entity.ts'
import { AppError } from '../helpers/AppError.ts'
import { Logger } from '../helpers/Logger.ts'
import { ResponseHandler } from '../helpers/ResponseHandler.ts'
import type { IEntityController } from '../types/IEntityController.ts'

export class DepartmentController implements IEntityController {
  constructor(private readonly departmentRepository: Repository<Department>) {}

  public getAll = async (_req: Request, res: Response): Promise<void> => {
    try {
      const departments = await this.departmentRepository.find()

      if (departments.length === 0) {
        ResponseHandler.sendErrorResponse(res, StatusCodes.NO_CONTENT)
        return
      }

      ResponseHandler.sendSuccessResponse(res, departments)
    } catch (error) {
      Logger.error('Unexpected error in DepartmentController.getAll', {
        error: error instanceof Error ? error.message : String(error),
      })
      ResponseHandler.sendErrorResponse(
        res,
        StatusCodes.INTERNAL_SERVER_ERROR,
        'Failed to retrieve departments'
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
      const department = await this.departmentRepository.findOne({ where: { id } })

      if (!department) {
        ResponseHandler.sendErrorResponse(
          res,
          StatusCodes.NOT_FOUND,
          `Department not found with ID: ${id}`
        )
        return
      }

      ResponseHandler.sendSuccessResponse(res, department)
    } catch (error) {
      Logger.error('Unexpected error in DepartmentController.getById', {
        error: error instanceof Error ? error.message : String(error),
      })
      ResponseHandler.sendErrorResponse(
        res,
        StatusCodes.INTERNAL_SERVER_ERROR,
        'Failed to retrieve department'
      )
    }
  }

  public create = async (req: Request, res: Response): Promise<void> => {
    try {
      const department = new Department()
      department.name = req.body.name

      const errors = await validate(department)
      if (errors.length > 0) {
        throw new AppError(
          errors.map((err) => Object.values(err.constraints || {})).join(', '),
          StatusCodes.UNPROCESSABLE_ENTITY
        )
      }

      const newDepartment = await this.departmentRepository.save(department)
      ResponseHandler.sendSuccessResponse(res, newDepartment, StatusCodes.CREATED)
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
      const department = await this.departmentRepository.findOneBy({ id })

      if (!department) {
        ResponseHandler.sendErrorResponse(res, StatusCodes.NOT_FOUND, 'Department not found')
        return
      }

      if (name !== undefined) department.name = name

      const errors = await validate(department)
      if (errors.length > 0) {
        throw new AppError(
          errors.map((err) => Object.values(err.constraints || {})).join(', '),
          StatusCodes.UNPROCESSABLE_ENTITY
        )
      }

      const updatedDepartment = await this.departmentRepository.save(department)
      ResponseHandler.sendSuccessResponse(res, updatedDepartment)
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
      const result = await this.departmentRepository.delete(id)

      if (result.affected === 0) {
        ResponseHandler.sendErrorResponse(res, StatusCodes.NOT_FOUND, 'Department not found')
        return
      }

      ResponseHandler.sendSuccessResponse(res, 'Department deleted')
    } catch (error) {
      if (error instanceof Error && error.message.includes('foreign key constraint')) {
        ResponseHandler.sendErrorResponse(
          res,
          StatusCodes.CONFLICT,
          'Cannot delete department: one or more users are assigned to it'
        )
        return
      }

      Logger.error('Unexpected error in DepartmentController.delete', {
        error: error instanceof Error ? error.message : String(error),
      })
      ResponseHandler.sendErrorResponse(
        res,
        StatusCodes.INTERNAL_SERVER_ERROR,
        'Failed to delete department'
      )
    }
  }
}
