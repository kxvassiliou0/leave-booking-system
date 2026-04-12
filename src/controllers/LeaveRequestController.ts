import { LeaveStatus, LeaveType } from '@enums'
import { validate } from 'class-validator'
import type { Request, Response } from 'express'
import { StatusCodes } from 'http-status-codes'
import type { Repository } from 'typeorm'
import { In, Not } from 'typeorm'
import { LeaveRequest } from '../entities/LeaveRequest.entity.ts'
import { User } from '../entities/User.entity.ts'
import { Logger } from '../helpers/Logger.ts'
import { ResponseHandler } from '../helpers/ResponseHandler.ts'

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

  private async getUsedDays(userId: number): Promise<number> {
    const approved = await this.leaveRepo.find({
      where: {
        userId,
        status: Not(In([LeaveStatus.Rejected, LeaveStatus.Cancelled, LeaveStatus.Pending])),
      },
    })
    return approved.reduce((total, lr) => total + lr.daysRequested, 0)
  }

  private async validateEntity(entity: object): Promise<string | null> {
    const errors = await validate(entity)
    if (errors.length > 0) {
      return errors.flatMap((e) => Object.values(e.constraints ?? {})).join(', ')
    }
    return null
  }

  createLeaveRequest = async (req: Request, res: Response): Promise<void> => {
    try {
      const { startDate, endDate, leaveType, reason, userId } = req.body

      if (!userId || isNaN(Number(userId))) {
        ResponseHandler.sendErrorResponse(res, StatusCodes.BAD_REQUEST, 'userId is required')
        return
      }

      if (!startDate || !endDate || !leaveType) {
        res
          .status(StatusCodes.BAD_REQUEST)
          .json({ error: 'startDate, endDate, and leaveType are required' })
        return
      }

      if (!VALID_LEAVE_TYPES.includes(leaveType as LeaveType)) {
        res.status(StatusCodes.BAD_REQUEST).json({
          error: `Invalid leaveType. Must be one of: ${VALID_LEAVE_TYPES.join(', ')}`,
        })
        return
      }

      const user = await this.userRepo.findOne({ where: { id: userId } })
      if (!user) {
        res.status(StatusCodes.NOT_FOUND).json({ error: `Employee with ID ${userId} not found` })
        return
      }

      const start = new Date(startDate)
      const end = new Date(endDate)

      if (isNaN(start.getTime())) {
        res.status(StatusCodes.BAD_REQUEST).json({ error: 'Invalid start date format' })
        return
      }
      if (isNaN(end.getTime())) {
        res.status(StatusCodes.BAD_REQUEST).json({ error: 'Invalid end date format' })
        return
      }
      if (end < start) {
        res.status(StatusCodes.BAD_REQUEST).json({ error: 'End date cannot be before start date' })
        return
      }

      const daysRequested = this.calculateDays(start, end)
      const usedDays = await this.getUsedDays(userId)

      if (usedDays + daysRequested > user.annualLeaveAllowance) {
        res.status(StatusCodes.BAD_REQUEST).json({
          error: `Insufficient leave balance. Available: ${user.annualLeaveAllowance - usedDays} days`,
        })
        return
      }

      const overlap = await this.leaveRepo
        .createQueryBuilder('lr')
        .where('lr.userId = :userId', { userId })
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
        res
          .status(StatusCodes.CONFLICT)
          .json({ error: 'Leave request overlaps with an existing request' })
        return
      }

      const leaveRequest = this.leaveRepo.create({
        userId,
        startDate: start,
        endDate: end,
        daysRequested,
        leaveType: leaveType as LeaveType,
        reason: reason ?? null,
        status: LeaveStatus.Pending,
      })

      const validationError = await this.validateEntity(leaveRequest)
      if (validationError) {
        res.status(StatusCodes.BAD_REQUEST).json({ error: validationError })
        return
      }

      const saved = await this.leaveRepo.save(leaveRequest)
      Logger.info('Leave request created', { id: saved.id, userId })
      res.status(StatusCodes.CREATED).json({ data: saved })
    } catch (err) {
      Logger.error('Unexpected error in createLeaveRequest', {
        error: String(err),
      })
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: 'Internal server error' })
    }
  }

  deleteLeaveRequest = async (req: Request, res: Response): Promise<void> => {
    try {
      const { leaveRequestId, userId: requestingUserId } = req.body

      if (!leaveRequestId || isNaN(Number(leaveRequestId))) {
        res.status(StatusCodes.BAD_REQUEST).json({ error: 'Invalid leave request ID' })
        return
      }

      const leaveRequest = await this.leaveRepo.findOne({
        where: { id: Number(leaveRequestId) },
      })
      if (!leaveRequest) {
        res
          .status(StatusCodes.NOT_FOUND)
          .json({ error: `Leave request with ID ${leaveRequestId} not found` })
        return
      }
      if (leaveRequest.userId !== requestingUserId) {
        res
          .status(StatusCodes.FORBIDDEN)
          .json({ error: 'You can only delete your own leave requests' })
        return
      }
      if (leaveRequest.status !== LeaveStatus.Pending) {
        res
          .status(StatusCodes.BAD_REQUEST)
          .json({ error: 'Only pending leave requests can be deleted' })
        return
      }

      await this.leaveRepo.remove(leaveRequest)
      Logger.info('Leave request deleted', {
        leaveRequestId,
        userId: requestingUserId,
      })
      res.status(StatusCodes.OK).json({ data: { message: 'Leave request deleted successfully' } })
    } catch (err) {
      Logger.error('Unexpected error in deleteLeaveRequest', {
        error: String(err),
      })
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: 'Internal server error' })
    }
  }

  approveLeaveRequest = async (req: Request, res: Response): Promise<void> => {
    try {
      const { leaveRequestId, managerNote, reviewerId } = req.body

      if (!leaveRequestId || isNaN(Number(leaveRequestId))) {
        res.status(StatusCodes.BAD_REQUEST).json({ error: 'Invalid leave request ID' })
        return
      }

      const leaveRequest = await this.leaveRepo.findOne({
        where: { id: Number(leaveRequestId) },
      })
      if (!leaveRequest) {
        res
          .status(StatusCodes.NOT_FOUND)
          .json({ error: `Leave request with ID ${leaveRequestId} not found` })
        return
      }
      if (leaveRequest.status !== LeaveStatus.Pending) {
        res
          .status(StatusCodes.BAD_REQUEST)
          .json({ error: 'Only pending leave requests can be approved' })
        return
      }

      leaveRequest.status = LeaveStatus.Approved
      leaveRequest.reviewedById = reviewerId
      leaveRequest.managerNote = managerNote ?? null

      const updated = await this.leaveRepo.save(leaveRequest)
      Logger.info('Leave request approved', { leaveRequestId, reviewerId })
      res.status(StatusCodes.OK).json({ data: updated })
    } catch (err) {
      Logger.error('Unexpected error in approveLeaveRequest', {
        error: String(err),
      })
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: 'Internal server error' })
    }
  }

  rejectLeaveRequest = async (req: Request, res: Response): Promise<void> => {
    try {
      const { leaveRequestId, managerNote, reviewerId } = req.body

      if (!leaveRequestId || isNaN(Number(leaveRequestId))) {
        res.status(StatusCodes.BAD_REQUEST).json({ error: 'Invalid leave request ID' })
        return
      }

      const leaveRequest = await this.leaveRepo.findOne({
        where: { id: Number(leaveRequestId) },
      })
      if (!leaveRequest) {
        res
          .status(StatusCodes.NOT_FOUND)
          .json({ error: `Leave request with ID ${leaveRequestId} not found` })
        return
      }
      if (leaveRequest.status !== LeaveStatus.Pending) {
        res
          .status(StatusCodes.BAD_REQUEST)
          .json({ error: 'Only pending leave requests can be rejected' })
        return
      }

      leaveRequest.status = LeaveStatus.Rejected
      leaveRequest.reviewedById = reviewerId
      leaveRequest.managerNote = managerNote ?? null

      const updated = await this.leaveRepo.save(leaveRequest)
      Logger.info('Leave request rejected', { leaveRequestId, reviewerId })
      res.status(StatusCodes.OK).json({ data: updated })
    } catch (err) {
      Logger.error('Unexpected error in rejectLeaveRequest', {
        error: String(err),
      })
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: 'Internal server error' })
    }
  }

  getLeaveRequestsByEmployee = async (req: Request<{ employee_id: string }>, res: Response): Promise<void> => {
    try {
      const employeeId = parseInt(req.params.employee_id, 10)

      if (isNaN(employeeId)) {
        res.status(StatusCodes.BAD_REQUEST).json({ error: 'Invalid employee ID' })
        return
      }

      const user = await this.userRepo.findOne({ where: { id: employeeId } })
      if (!user) {
        res
          .status(StatusCodes.NOT_FOUND)
          .json({ error: `Employee with ID ${employeeId} not found` })
        return
      }

      const leaveRequests = await this.leaveRepo.find({
        where: { userId: employeeId },
        order: { createdAt: 'DESC' },
      })

      res.status(StatusCodes.OK).json({ data: leaveRequests })
    } catch (err) {
      Logger.error('Unexpected error in getLeaveRequestsByEmployee', {
        error: String(err),
      })
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: 'Internal server error' })
    }
  }

  getRemainingLeave = async (req: Request<{ employee_id: string }>, res: Response): Promise<void> => {
    try {
      const employeeId = parseInt(req.params.employee_id, 10)

      if (isNaN(employeeId)) {
        res.status(StatusCodes.BAD_REQUEST).json({ error: 'Invalid employee ID' })
        return
      }

      const user = await this.userRepo.findOne({ where: { id: employeeId } })
      if (!user) {
        res
          .status(StatusCodes.NOT_FOUND)
          .json({ error: `Employee with ID ${employeeId} not found` })
        return
      }

      const usedDays = await this.getUsedDays(employeeId)

      res.status(StatusCodes.OK).json({
        data: {
          userId: employeeId,
          annualLeaveAllowance: user.annualLeaveAllowance,
          usedDays,
          remainingDays: user.annualLeaveAllowance - usedDays,
        },
      })
    } catch (err) {
      Logger.error('Unexpected error in getRemainingLeave', {
        error: String(err),
      })
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: 'Internal server error' })
    }
  }
}
