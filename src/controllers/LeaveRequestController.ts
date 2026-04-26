import { LeaveStatus, LeaveType, RoleType } from '@enums'
import { validate } from 'class-validator'
import type { Response } from 'express'
import { StatusCodes } from 'http-status-codes'
import type { Repository } from 'typeorm'
import { Between, In } from 'typeorm'
import { LeaveRequest } from '../entities/LeaveRequest.entity.ts'
import { User } from '../entities/User.entity.ts'
import { Logger } from '../helpers/Logger.ts'
import { ResponseHandler } from '../helpers/ResponseHandler.ts'
import type { AuthenticatedJWTRequest as Request } from '../interfaces/AuthenticatedJWTRequest.interface.ts'

const VALID_LEAVE_TYPES = Object.values(LeaveType)

export class LeaveRequestController {
  constructor(
    private readonly userRepo: Repository<User>,
    private readonly leaveRepo: Repository<LeaveRequest>
  ) {}

  private calculateDays(start: Date, end: Date): number {
    const msPerDay = 1000 * 60 * 60 * 24
    return Math.round((end.getTime() - start.getTime()) / msPerDay) + 1
  }

  private toDateString(date: Date): string {
    return date.toISOString().split('T')[0]
  }

  private getBusinessYear(referenceDate: Date = new Date()): {
    start: Date
    end: Date
  } {
    const year =
      referenceDate.getMonth() >= 3 ?
        referenceDate.getFullYear()
      : referenceDate.getFullYear() - 1
    return {
      start: new Date(year, 3, 1),
      end: new Date(year + 1, 2, 31),
    }
  }

  private async getUsedDays(
    userId: number,
    referenceDate: Date = new Date()
  ): Promise<number> {
    const { start, end } = this.getBusinessYear(referenceDate)
    const approved = await this.leaveRepo.find({
      where: {
        userId,
        status: LeaveStatus.Approved,
        startDate: Between(start, end),
      },
    })
    return approved.reduce((total, lr) => total + lr.daysRequested, 0)
  }

  private async validateEntity(entity: object): Promise<string | null> {
    const errors = await validate(entity)
    if (errors.length > 0) {
      return errors.flatMap(e => Object.values(e.constraints ?? {})).join(', ')
    }
    return null
  }

  private async canAccessEmployee(
    req: Request,
    employeeId: number
  ): Promise<boolean> {
    const signedInUser = req.signedInUser?.token
    if (!signedInUser) return false

    if (signedInUser.role === RoleType.Admin) return true

    if (signedInUser.role === RoleType.Employee)
      return signedInUser.id === employeeId

    if (signedInUser.id === employeeId) return true
    const report = await this.userRepo.findOne({
      where: { id: employeeId, managerId: signedInUser.id },
    })
    return report !== null
  }

  private formatLeaveRequest(lr: LeaveRequest) {
    return {
      id: lr.id,
      employee_id: lr.userId,
      leave_type: lr.leaveType,
      start_date: this.toDateString(new Date(lr.startDate)),
      end_date: this.toDateString(new Date(lr.endDate)),
      status: lr.status,
      reason: lr.reason ?? null,
      manager_note: lr.managerNote ?? null,
    }
  }

  createLeaveRequest = async (req: Request, res: Response): Promise<void> => {
    try {
      const signedInUser = req.signedInUser?.token
      const isAdmin = signedInUser?.role === RoleType.Admin

      const employee_id = isAdmin ? req.body.employee_id : signedInUser?.id
      const { start_date, end_date, leave_type, reason } = req.body

      if (!employee_id || isNaN(Number(employee_id))) {
        ResponseHandler.sendErrorResponse(
          res,
          StatusCodes.BAD_REQUEST,
          'Invalid employee ID'
        )
        return
      }

      if (!start_date || !end_date) {
        ResponseHandler.sendErrorResponse(
          res,
          StatusCodes.BAD_REQUEST,
          'start_date and end_date are required'
        )
        return
      }

      const start = new Date(start_date)
      const end = new Date(end_date)

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        ResponseHandler.sendErrorResponse(
          res,
          StatusCodes.BAD_REQUEST,
          'Invalid date format'
        )
        return
      }

      if (end < start) {
        ResponseHandler.sendErrorResponse(
          res,
          StatusCodes.BAD_REQUEST,
          `End date of ${this.toDateString(end)} is before the start date of ${this.toDateString(start)}`
        )
        return
      }

      if (!leave_type) {
        ResponseHandler.sendErrorResponse(
          res,
          StatusCodes.BAD_REQUEST,
          'leave_type is required'
        )
        return
      }
      if (!VALID_LEAVE_TYPES.includes(leave_type as LeaveType)) {
        ResponseHandler.sendErrorResponse(
          res,
          StatusCodes.BAD_REQUEST,
          `Invalid leave_type. Must be one of: ${VALID_LEAVE_TYPES.join(', ')}`
        )
        return
      }
      const resolvedLeaveType = leave_type as LeaveType

      const user = await this.userRepo.findOne({
        where: { id: Number(employee_id) },
      })
      if (!user) {
        ResponseHandler.sendErrorResponse(
          res,
          StatusCodes.BAD_REQUEST,
          'Invalid employee ID'
        )
        return
      }

      const daysRequested = this.calculateDays(start, end)
      const usedDays = await this.getUsedDays(Number(employee_id), start)

      if (usedDays + daysRequested > user.annualLeaveAllowance) {
        ResponseHandler.sendErrorResponse(
          res,
          StatusCodes.BAD_REQUEST,
          'Days requested exceed remaining balance'
        )
        return
      }

      const overlap = await this.leaveRepo
        .createQueryBuilder('lr')
        .where('lr.userId = :userId', { userId: Number(employee_id) })
        .andWhere('lr.status NOT IN (:...statuses)', {
          statuses: [LeaveStatus.Rejected, LeaveStatus.Cancelled],
        })
        .andWhere('lr.startDate <= :endDate', {
          endDate: this.toDateString(end),
        })
        .andWhere('lr.endDate >= :startDate', {
          startDate: this.toDateString(start),
        })
        .getOne()

      if (overlap) {
        ResponseHandler.sendErrorResponse(
          res,
          StatusCodes.CONFLICT,
          'Date range of request overlaps with existing request'
        )
        return
      }

      const leaveRequest = this.leaveRepo.create({
        userId: Number(employee_id),
        startDate: start,
        endDate: end,
        daysRequested,
        leaveType: resolvedLeaveType as LeaveType,
        reason: reason ?? null,
        status: LeaveStatus.Pending,
      })

      const validationError = await this.validateEntity(leaveRequest)
      if (validationError) {
        ResponseHandler.sendErrorResponse(
          res,
          StatusCodes.BAD_REQUEST,
          'Invalid request'
        )
        return
      }

      const saved = await this.leaveRepo.save(leaveRequest)
      Logger.info('Leave request created', { id: saved.id, employee_id })
      res.status(StatusCodes.CREATED).json({
        message: 'Leave request has been submitted for review',
        data: this.formatLeaveRequest(saved),
      })
    } catch (err) {
      Logger.error('Unexpected error in createLeaveRequest', {
        error: err instanceof Error ? err.message : String(err),
      })
      ResponseHandler.sendErrorResponse(
        res,
        StatusCodes.INTERNAL_SERVER_ERROR,
        'Internal server error'
      )
    }
  }

  deleteLeaveRequest = async (req: Request, res: Response): Promise<void> => {
    try {
      const { employee_id, leave_request_id, reason } = req.body

      if (!employee_id || isNaN(Number(employee_id))) {
        ResponseHandler.sendErrorResponse(
          res,
          StatusCodes.BAD_REQUEST,
          'Invalid employee ID'
        )
        return
      }

      if (!leave_request_id || isNaN(Number(leave_request_id))) {
        ResponseHandler.sendErrorResponse(
          res,
          StatusCodes.BAD_REQUEST,
          'Invalid leave request ID'
        )
        return
      }

      const leaveRequest = await this.leaveRepo.findOne({
        where: { id: Number(leave_request_id) },
      })
      if (!leaveRequest) {
        ResponseHandler.sendErrorResponse(
          res,
          StatusCodes.BAD_REQUEST,
          'Invalid leave request ID'
        )
        return
      }

      if (leaveRequest.userId !== Number(employee_id)) {
        ResponseHandler.sendErrorResponse(
          res,
          StatusCodes.FORBIDDEN,
          'Unauthorised'
        )
        return
      }

      leaveRequest.status = LeaveStatus.Cancelled
      if (reason) leaveRequest.managerNote = reason

      const updated = await this.leaveRepo.save(leaveRequest)
      Logger.info('Leave request cancelled', { leave_request_id, employee_id })

      const responseData: Record<string, unknown> = {
        message: 'Leave request has been cancelled',
        data: this.formatLeaveRequest(updated),
      }
      if (reason) responseData.reason = reason

      res.status(StatusCodes.OK).json(responseData)
    } catch (err) {
      Logger.error('Unexpected error in deleteLeaveRequest', {
        error: err instanceof Error ? err.message : String(err),
      })
      ResponseHandler.sendErrorResponse(
        res,
        StatusCodes.INTERNAL_SERVER_ERROR,
        'Internal server error'
      )
    }
  }

  approveLeaveRequest = async (req: Request, res: Response): Promise<void> => {
    try {
      const { leave_request_id, reason } = req.body

      if (!leave_request_id || isNaN(Number(leave_request_id))) {
        ResponseHandler.sendErrorResponse(
          res,
          StatusCodes.BAD_REQUEST,
          'Invalid leave request ID'
        )
        return
      }

      const leaveRequest = await this.leaveRepo.findOne({
        where: { id: Number(leave_request_id) },
      })
      if (!leaveRequest) {
        ResponseHandler.sendErrorResponse(
          res,
          StatusCodes.BAD_REQUEST,
          'Invalid leave request ID'
        )
        return
      }
      if (leaveRequest.status !== LeaveStatus.Pending) {
        ResponseHandler.sendErrorResponse(
          res,
          StatusCodes.BAD_REQUEST,
          'Invalid leave request ID'
        )
        return
      }

      const approver = req.signedInUser?.token
      if (approver?.role === RoleType.Manager) {
        const employee = await this.userRepo.findOne({
          where: { id: leaveRequest.userId },
        })
        if (!employee || employee.managerId !== approver.id) {
          ResponseHandler.sendErrorResponse(
            res,
            StatusCodes.FORBIDDEN,
            'You can only approve leave requests for your direct reports'
          )
          return
        }
      }

      leaveRequest.status = LeaveStatus.Approved
      leaveRequest.managerNote = reason ?? null

      await this.leaveRepo.save(leaveRequest)
      Logger.info('Leave request approved', { leave_request_id })
      res.status(StatusCodes.OK).json({
        message: `Leave request ${leave_request_id} for employee_id ${leaveRequest.userId} has been approved`,
        data: { reason: reason ?? null },
      })
    } catch (err) {
      Logger.error('Unexpected error in approveLeaveRequest', {
        error: err instanceof Error ? err.message : String(err),
      })
      ResponseHandler.sendErrorResponse(
        res,
        StatusCodes.INTERNAL_SERVER_ERROR,
        'Internal server error'
      )
    }
  }

  rejectLeaveRequest = async (req: Request, res: Response): Promise<void> => {
    try {
      const { leave_request_id, reason } = req.body

      if (!leave_request_id || isNaN(Number(leave_request_id))) {
        ResponseHandler.sendErrorResponse(
          res,
          StatusCodes.BAD_REQUEST,
          'Invalid leave request ID'
        )
        return
      }

      const leaveRequest = await this.leaveRepo.findOne({
        where: { id: Number(leave_request_id) },
      })
      if (!leaveRequest) {
        ResponseHandler.sendErrorResponse(
          res,
          StatusCodes.BAD_REQUEST,
          'Invalid leave request ID'
        )
        return
      }
      if (leaveRequest.status !== LeaveStatus.Pending) {
        ResponseHandler.sendErrorResponse(
          res,
          StatusCodes.BAD_REQUEST,
          'Invalid leave request ID'
        )
        return
      }

      const rejecter = req.signedInUser?.token
      if (rejecter?.role === RoleType.Manager) {
        const employee = await this.userRepo.findOne({
          where: { id: leaveRequest.userId },
        })
        if (!employee || employee.managerId !== rejecter.id) {
          ResponseHandler.sendErrorResponse(
            res,
            StatusCodes.FORBIDDEN,
            'You can only reject leave requests for your direct reports'
          )
          return
        }
      }

      leaveRequest.status = LeaveStatus.Rejected
      leaveRequest.managerNote = reason ?? null

      await this.leaveRepo.save(leaveRequest)
      Logger.info('Leave request rejected', { leave_request_id })
      res.status(StatusCodes.OK).json({
        message: `Leave request ${leave_request_id} for employee_id ${leaveRequest.userId} has been rejected`,
        data: { reason: reason ?? null },
      })
    } catch (err) {
      Logger.error('Unexpected error in rejectLeaveRequest', {
        error: err instanceof Error ? err.message : String(err),
      })
      ResponseHandler.sendErrorResponse(
        res,
        StatusCodes.INTERNAL_SERVER_ERROR,
        'Internal server error'
      )
    }
  }

  getLeaveRequestsByEmployee = async (
    req: Request & { params: { employee_id: string } },
    res: Response
  ): Promise<void> => {
    try {
      const employeeId = parseInt(req.params.employee_id, 10)

      if (isNaN(employeeId)) {
        ResponseHandler.sendErrorResponse(
          res,
          StatusCodes.BAD_REQUEST,
          'Invalid employee ID'
        )
        return
      }

      if (!(await this.canAccessEmployee(req, employeeId))) {
        ResponseHandler.sendErrorResponse(
          res,
          StatusCodes.FORBIDDEN,
          'You are not authorised to view leave requests for this employee'
        )
        return
      }

      const user = await this.userRepo.findOne({ where: { id: employeeId } })
      if (!user) {
        ResponseHandler.sendErrorResponse(
          res,
          StatusCodes.BAD_REQUEST,
          'Invalid employee ID'
        )
        return
      }

      const leaveRequests = await this.leaveRepo.find({
        where: { userId: employeeId },
        order: { createdAt: 'DESC' },
      })

      res.status(StatusCodes.OK).json({
        message: `Status of leave requests for employee_id ${employeeId}`,
        data: leaveRequests.map(lr => this.formatLeaveRequest(lr)),
      })
    } catch (err) {
      Logger.error('Unexpected error in getLeaveRequestsByEmployee', {
        error: err instanceof Error ? err.message : String(err),
      })
      ResponseHandler.sendErrorResponse(
        res,
        StatusCodes.INTERNAL_SERVER_ERROR,
        'Internal server error'
      )
    }
  }

  getRemainingLeave = async (
    req: Request & { params: { employee_id: string } },
    res: Response
  ): Promise<void> => {
    try {
      const employeeId = parseInt(req.params.employee_id, 10)

      if (isNaN(employeeId)) {
        ResponseHandler.sendErrorResponse(
          res,
          StatusCodes.BAD_REQUEST,
          'Invalid employee ID'
        )
        return
      }

      if (!(await this.canAccessEmployee(req, employeeId))) {
        ResponseHandler.sendErrorResponse(
          res,
          StatusCodes.FORBIDDEN,
          'You are not authorised to view leave balance for this employee'
        )
        return
      }

      const user = await this.userRepo.findOne({ where: { id: employeeId } })
      if (!user) {
        ResponseHandler.sendErrorResponse(
          res,
          StatusCodes.BAD_REQUEST,
          'Invalid employee ID'
        )
        return
      }

      const usedDays = await this.getUsedDays(employeeId)
      const { start, end } = this.getBusinessYear()

      res.status(StatusCodes.OK).json({
        message: `Leave balance for employee_id ${employeeId}`,
        data: {
          annual_allowance: user.annualLeaveAllowance,
          days_used: usedDays,
          days_remaining: user.annualLeaveAllowance - usedDays,
          business_year: `${this.toDateString(start)} to ${this.toDateString(end)}`,
        },
      })
    } catch (err) {
      Logger.error('Unexpected error in getRemainingLeave', {
        error: err instanceof Error ? err.message : String(err),
      })
      ResponseHandler.sendErrorResponse(
        res,
        StatusCodes.INTERNAL_SERVER_ERROR,
        'Internal server error'
      )
    }
  }

  getPendingRequestsByManager = async (
    req: Request & { params: { manager_id: string } },
    res: Response
  ): Promise<void> => {
    try {
      const signedInUser = req.signedInUser?.token
      const isAdmin = signedInUser?.role === RoleType.Admin
      const managerId =
        isAdmin ? parseInt(req.params.manager_id, 10) : signedInUser?.id

      if (managerId === undefined || isNaN(managerId)) {
        ResponseHandler.sendErrorResponse(
          res,
          StatusCodes.BAD_REQUEST,
          'Invalid manager ID'
        )
        return
      }

      const manager = await this.userRepo.findOne({ where: { id: managerId } })
      if (!manager) {
        ResponseHandler.sendErrorResponse(
          res,
          StatusCodes.BAD_REQUEST,
          'Invalid manager ID'
        )
        return
      }

      const team = await this.userRepo.find({ where: { managerId } })

      if (team.length === 0) {
        res.status(StatusCodes.OK).json({
          message: `No team members assigned to manager_id ${managerId}`,
          data: [],
        })
        return
      }

      const teamIds = team.map(u => u.id)
      const pendingRequests = await this.leaveRepo.find({
        where: { userId: In(teamIds), status: LeaveStatus.Pending },
        order: { createdAt: 'ASC' },
      })

      res.status(StatusCodes.OK).json({
        message: `Pending leave requests for manager_id ${managerId}'s team`,
        data: pendingRequests.map(lr => this.formatLeaveRequest(lr)),
      })
    } catch (err) {
      Logger.error('Unexpected error in getPendingRequestsByManager', {
        error: err instanceof Error ? err.message : String(err),
      })
      ResponseHandler.sendErrorResponse(
        res,
        StatusCodes.INTERNAL_SERVER_ERROR,
        'Internal server error'
      )
    }
  }

  getAllLeaveRequests = async (req: Request, res: Response): Promise<void> => {
    try {
      const signedInUser = req.signedInUser?.token
      const isAdmin = signedInUser?.role === RoleType.Admin
      const { employee_id, manager_id } = req.query

      if (!isAdmin) {
        const managerId = signedInUser?.id
        const team = await this.userRepo.find({ where: { managerId } })
        if (team.length === 0) {
          res.status(StatusCodes.OK).json({
            message: `No team members assigned to your account`,
            data: [],
          })
          return
        }
        const teamIds = team.map(u => u.id)
        const requests = await this.leaveRepo.find({
          where: { userId: In(teamIds) },
          order: { createdAt: 'DESC' },
        })
        res.status(StatusCodes.OK).json({
          message: `Leave requests for your team`,
          data: requests.map(lr => this.formatLeaveRequest(lr)),
        })
        return
      }

      if (employee_id !== undefined && manager_id !== undefined) {
        ResponseHandler.sendErrorResponse(
          res,
          StatusCodes.BAD_REQUEST,
          'Provide either employee_id or manager_id, not both'
        )
        return
      }

      if (employee_id !== undefined) {
        const id = parseInt(employee_id as string, 10)
        if (isNaN(id)) {
          ResponseHandler.sendErrorResponse(
            res,
            StatusCodes.BAD_REQUEST,
            'Invalid employee_id'
          )
          return
        }
        const user = await this.userRepo.findOne({ where: { id } })
        if (!user) {
          ResponseHandler.sendErrorResponse(
            res,
            StatusCodes.BAD_REQUEST,
            'Employee not found'
          )
          return
        }
        const requests = await this.leaveRepo.find({
          where: { userId: id },
          order: { createdAt: 'DESC' },
        })
        res.status(StatusCodes.OK).json({
          message: `Leave requests for employee_id ${id}`,
          data: requests.map(lr => this.formatLeaveRequest(lr)),
        })
        return
      }

      if (manager_id !== undefined) {
        const id = parseInt(manager_id as string, 10)
        if (isNaN(id)) {
          ResponseHandler.sendErrorResponse(
            res,
            StatusCodes.BAD_REQUEST,
            'Invalid manager_id'
          )
          return
        }
        const manager = await this.userRepo.findOne({ where: { id } })
        if (!manager) {
          ResponseHandler.sendErrorResponse(
            res,
            StatusCodes.BAD_REQUEST,
            'Manager not found'
          )
          return
        }
        const team = await this.userRepo.find({ where: { managerId: id } })
        if (team.length === 0) {
          res.status(StatusCodes.OK).json({
            message: `No team members assigned to manager_id ${id}`,
            data: [],
          })
          return
        }
        const teamIds = team.map(u => u.id)
        const requests = await this.leaveRepo.find({
          where: { userId: In(teamIds) },
          order: { createdAt: 'DESC' },
        })
        res.status(StatusCodes.OK).json({
          message: `Leave requests for manager_id ${id}'s team`,
          data: requests.map(lr => this.formatLeaveRequest(lr)),
        })
        return
      }

      const requests = await this.leaveRepo.find({
        order: { createdAt: 'DESC' },
      })
      res.status(StatusCodes.OK).json({
        message: 'All leave requests',
        data: requests.map(lr => this.formatLeaveRequest(lr)),
      })
    } catch (err) {
      Logger.error('Unexpected error in getAllLeaveRequests', {
        error: err instanceof Error ? err.message : String(err),
      })
      ResponseHandler.sendErrorResponse(
        res,
        StatusCodes.INTERNAL_SERVER_ERROR,
        'Internal server error'
      )
    }
  }
}
