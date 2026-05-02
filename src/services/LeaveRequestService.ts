import { LeaveStatus, LeaveType, RoleType } from '@enums'
import { validate } from 'class-validator'
import { StatusCodes } from 'http-status-codes'
import type { Repository } from 'typeorm'
import { Between, FindOptionsWhere, In, LessThanOrEqual, MoreThanOrEqual } from 'typeorm'
import { LeaveRequest } from '../entities/LeaveRequest.entity.ts'
import { User } from '../entities/User.entity.ts'
import { AppError } from '../helpers/AppError.ts'
import { Logger } from '../helpers/Logger.ts'
import type {
  DateRangeQuery,
  ILeaveRequestService,
  ServiceResult,
  TokenPayload,
} from '../types/ILeaveRequestService.ts'

const VALID_LEAVE_TYPES = Object.values(LeaveType)

export class LeaveRequestService implements ILeaveRequestService {
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

  getBusinessYear(referenceDate: Date = new Date()): { start: Date; end: Date } {
    const year =
      referenceDate.getMonth() >= 3 ?
        referenceDate.getFullYear()
      : referenceDate.getFullYear() - 1
    return {
      start: new Date(year, 3, 1),
      end: new Date(year + 1, 2, 31),
    }
  }

  async getUsedDays(userId: number, referenceDate: Date = new Date()): Promise<number> {
    const { start, end } = this.getBusinessYear(referenceDate)
    const approved = await this.leaveRepo.find({
      where: { userId, status: LeaveStatus.Approved, startDate: Between(start, end) },
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

  async canAccessEmployee(token: TokenPayload, employeeId: number): Promise<boolean> {
    if (token.role === RoleType.Admin) return true
    if (token.role === RoleType.Employee) return token.id === employeeId
    if (token.id === employeeId) return true
    const report = await this.userRepo.findOne({
      where: { id: employeeId, managerId: token.id },
    })
    return report !== null
  }

  formatLeaveRequest(lr: LeaveRequest) {
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

  private formatOwnLeaveRequest(lr: LeaveRequest) {
    return {
      id: lr.id,
      leave_type: lr.leaveType,
      start_date: this.toDateString(new Date(lr.startDate)),
      end_date: this.toDateString(new Date(lr.endDate)),
      status: lr.status,
      reason: lr.reason ?? null,
      manager_note: lr.managerNote ?? null,
    }
  }

  async createLeaveRequest(
    token: TokenPayload | undefined,
    body: Record<string, unknown>
  ): Promise<ServiceResult> {
    const isAdmin = token?.role === RoleType.Admin
    const employee_id = isAdmin ? body.employee_id : token?.id
    const { start_date, end_date, leave_type, reason } = body as {
      start_date?: string
      end_date?: string
      leave_type?: string
      reason?: string
    }

    if (!employee_id || isNaN(Number(employee_id))) {
      throw new AppError('Invalid employee ID', StatusCodes.BAD_REQUEST)
    }
    if (!start_date || !end_date) {
      throw new AppError('start_date and end_date are required', StatusCodes.BAD_REQUEST)
    }

    const start = new Date(start_date)
    const end = new Date(end_date)

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new AppError('Invalid date format', StatusCodes.BAD_REQUEST)
    }
    if (end < start) {
      throw new AppError(
        `End date of ${this.toDateString(end)} is before the start date of ${this.toDateString(start)}`,
        StatusCodes.BAD_REQUEST
      )
    }
    if (!leave_type) {
      throw new AppError('leave_type is required', StatusCodes.BAD_REQUEST)
    }
    if (!VALID_LEAVE_TYPES.includes(leave_type as LeaveType)) {
      throw new AppError(
        `Invalid leave_type. Must be one of: ${VALID_LEAVE_TYPES.join(', ')}`,
        StatusCodes.BAD_REQUEST
      )
    }

    const user = await this.userRepo.findOne({ where: { id: Number(employee_id) } })
    if (!user) {
      throw new AppError('Invalid employee ID', StatusCodes.BAD_REQUEST)
    }

    const daysRequested = this.calculateDays(start, end)
    const usedDays = await this.getUsedDays(Number(employee_id), start)
    if (usedDays + daysRequested > user.annualLeaveAllowance) {
      throw new AppError('Days requested exceed remaining balance', StatusCodes.BAD_REQUEST)
    }

    const overlap = await this.leaveRepo
      .createQueryBuilder('lr')
      .where('lr.userId = :userId', { userId: Number(employee_id) })
      .andWhere('lr.status NOT IN (:...statuses)', {
        statuses: [LeaveStatus.Rejected, LeaveStatus.Cancelled],
      })
      .andWhere('lr.startDate <= :endDate', { endDate: this.toDateString(end) })
      .andWhere('lr.endDate >= :startDate', { startDate: this.toDateString(start) })
      .getOne()

    if (overlap) {
      throw new AppError(
        'Date range of request overlaps with existing request',
        StatusCodes.CONFLICT
      )
    }

    const leaveRequest = this.leaveRepo.create({
      userId: Number(employee_id),
      startDate: start,
      endDate: end,
      daysRequested,
      leaveType: leave_type as LeaveType,
      reason: reason ?? null,
      status: LeaveStatus.Pending,
    })

    const validationError = await this.validateEntity(leaveRequest)
    if (validationError) {
      throw new AppError('Invalid request', StatusCodes.BAD_REQUEST)
    }

    const saved = await this.leaveRepo.save(leaveRequest)
    Logger.info('Leave request created', { id: saved.id, employee_id })
    return {
      message: 'Leave request has been submitted for review',
      data: this.formatLeaveRequest(saved),
    }
  }

  async deleteLeaveRequest(
    token: TokenPayload | undefined,
    body: Record<string, unknown>
  ): Promise<ServiceResult> {
    const isAdmin = token?.role === RoleType.Admin
    const employee_id = isAdmin ? (body.employee_id ?? token?.id) : token?.id
    const { leave_request_id, reason } = body as {
      leave_request_id?: unknown
      reason?: string
    }

    if (!employee_id || isNaN(Number(employee_id))) {
      throw new AppError('Invalid employee ID', StatusCodes.BAD_REQUEST)
    }
    if (!leave_request_id || isNaN(Number(leave_request_id))) {
      throw new AppError('Invalid leave request ID', StatusCodes.BAD_REQUEST)
    }

    const leaveRequest = await this.leaveRepo.findOne({
      where: { id: Number(leave_request_id) },
    })
    if (!leaveRequest) {
      throw new AppError('Invalid leave request ID', StatusCodes.BAD_REQUEST)
    }
    if (leaveRequest.userId !== Number(employee_id)) {
      throw new AppError('Unauthorised', StatusCodes.FORBIDDEN)
    }

    leaveRequest.status = LeaveStatus.Cancelled
    if (reason) leaveRequest.managerNote = reason

    const updated = await this.leaveRepo.save(leaveRequest)
    Logger.info('Leave request cancelled', { leave_request_id, employee_id })

    const data: Record<string, unknown> = { ...this.formatLeaveRequest(updated) }
    if (reason) data.reason = reason

    return { message: 'Leave request has been cancelled', data }
  }

  async approveLeaveRequest(
    token: TokenPayload | undefined,
    body: Record<string, unknown>
  ): Promise<ServiceResult> {
    const { leave_request_id, reason } = body as {
      leave_request_id?: unknown
      reason?: string
    }

    if (!leave_request_id || isNaN(Number(leave_request_id))) {
      throw new AppError('Invalid leave request ID', StatusCodes.BAD_REQUEST)
    }

    const leaveRequest = await this.leaveRepo.findOne({
      where: { id: Number(leave_request_id) },
    })
    if (!leaveRequest) {
      throw new AppError('Invalid leave request ID', StatusCodes.BAD_REQUEST)
    }
    if (leaveRequest.status !== LeaveStatus.Pending) {
      throw new AppError('Invalid leave request ID', StatusCodes.BAD_REQUEST)
    }

    if (token?.role === RoleType.Manager) {
      const employee = await this.userRepo.findOne({ where: { id: leaveRequest.userId } })
      if (!employee || employee.managerId !== token.id) {
        throw new AppError(
          'You can only approve leave requests for your direct reports',
          StatusCodes.FORBIDDEN
        )
      }
    }

    leaveRequest.status = LeaveStatus.Approved
    leaveRequest.managerNote = reason ?? null
    await this.leaveRepo.save(leaveRequest)
    Logger.info('Leave request approved', { leave_request_id })

    return {
      message: `Leave request ${leave_request_id} for employee_id ${leaveRequest.userId} has been approved`,
      data: { reason: reason ?? null },
    }
  }

  async rejectLeaveRequest(
    token: TokenPayload | undefined,
    body: Record<string, unknown>
  ): Promise<ServiceResult> {
    const { leave_request_id, reason } = body as {
      leave_request_id?: unknown
      reason?: string
    }

    if (!leave_request_id || isNaN(Number(leave_request_id))) {
      throw new AppError('Invalid leave request ID', StatusCodes.BAD_REQUEST)
    }

    const leaveRequest = await this.leaveRepo.findOne({
      where: { id: Number(leave_request_id) },
    })
    if (!leaveRequest) {
      throw new AppError('Invalid leave request ID', StatusCodes.BAD_REQUEST)
    }
    if (leaveRequest.status !== LeaveStatus.Pending) {
      throw new AppError('Invalid leave request ID', StatusCodes.BAD_REQUEST)
    }

    if (token?.role === RoleType.Manager) {
      const employee = await this.userRepo.findOne({ where: { id: leaveRequest.userId } })
      if (!employee || employee.managerId !== token.id) {
        throw new AppError(
          'You can only reject leave requests for your direct reports',
          StatusCodes.FORBIDDEN
        )
      }
    }

    leaveRequest.status = LeaveStatus.Rejected
    leaveRequest.managerNote = reason ?? null
    await this.leaveRepo.save(leaveRequest)
    Logger.info('Leave request rejected', { leave_request_id })

    return {
      message: `Leave request ${leave_request_id} for employee_id ${leaveRequest.userId} has been rejected`,
      data: { reason: reason ?? null },
    }
  }

  async getLeaveRequestsByEmployee(
    token: TokenPayload | undefined,
    employeeId: number
  ): Promise<ServiceResult> {
    if (isNaN(employeeId)) {
      throw new AppError('Invalid employee ID', StatusCodes.BAD_REQUEST)
    }
    if (!token || !(await this.canAccessEmployee(token, employeeId))) {
      throw new AppError(
        'You are not authorised to view leave requests for this employee',
        StatusCodes.FORBIDDEN
      )
    }

    const user = await this.userRepo.findOne({ where: { id: employeeId } })
    if (!user) {
      throw new AppError('Invalid employee ID', StatusCodes.BAD_REQUEST)
    }

    const leaveRequests = await this.leaveRepo.find({
      where: { userId: employeeId },
      order: { createdAt: 'DESC' },
    })

    return {
      message: `Status of leave requests for employee_id ${employeeId}`,
      data: leaveRequests.map(lr => this.formatOwnLeaveRequest(lr)),
    }
  }

  async getRemainingLeave(
    token: TokenPayload | undefined,
    employeeId: number
  ): Promise<ServiceResult> {
    if (isNaN(employeeId)) {
      throw new AppError('Invalid employee ID', StatusCodes.BAD_REQUEST)
    }
    if (!token || !(await this.canAccessEmployee(token, employeeId))) {
      throw new AppError(
        'You are not authorised to view leave balance for this employee',
        StatusCodes.FORBIDDEN
      )
    }

    const user = await this.userRepo.findOne({ where: { id: employeeId } })
    if (!user) {
      throw new AppError('Invalid employee ID', StatusCodes.BAD_REQUEST)
    }

    const usedDays = await this.getUsedDays(employeeId)

    return {
      message: `Leave balance for employee_id ${employeeId}`,
      data: {
        annual_allowance: user.annualLeaveAllowance,
        days_used: usedDays,
        days_remaining: user.annualLeaveAllowance - usedDays,
      },
    }
  }

  async getPendingRequestsByManager(
    token: TokenPayload | undefined,
    rawManagerId: number,
    query: DateRangeQuery
  ): Promise<ServiceResult> {
    if (isNaN(rawManagerId)) {
      throw new AppError('Invalid manager ID', StatusCodes.BAD_REQUEST)
    }

    const isAdmin = token?.role === RoleType.Admin
    const managerId = isAdmin ? rawManagerId : token?.id

    if (managerId === undefined || isNaN(managerId)) {
      throw new AppError('Invalid manager ID', StatusCodes.BAD_REQUEST)
    }

    const manager = await this.userRepo.findOne({ where: { id: managerId } })
    if (!manager) {
      throw new AppError('Invalid manager ID', StatusCodes.BAD_REQUEST)
    }

    let fromDate: Date | undefined
    let toDate: Date | undefined

    if (query.from !== undefined) {
      fromDate = new Date(query.from)
      if (isNaN(fromDate.getTime())) {
        throw new AppError('Invalid from date format', StatusCodes.BAD_REQUEST)
      }
    }
    if (query.to !== undefined) {
      toDate = new Date(query.to)
      if (isNaN(toDate.getTime())) {
        throw new AppError('Invalid to date format', StatusCodes.BAD_REQUEST)
      }
    }
    if (fromDate && toDate && fromDate > toDate) {
      throw new AppError('from date must not be after to date', StatusCodes.BAD_REQUEST)
    }

    const team = await this.userRepo.find({ where: { managerId } })
    if (team.length === 0) {
      return {
        message: `No team members assigned to manager_id ${managerId}`,
        data: [],
      }
    }

    const teamIds = team.map(u => u.id)
    const where: FindOptionsWhere<LeaveRequest> = {
      userId: In(teamIds),
      status: LeaveStatus.Pending,
    }
    if (fromDate) where.endDate = MoreThanOrEqual(fromDate)
    if (toDate) where.startDate = LessThanOrEqual(toDate)

    const pendingRequests = await this.leaveRepo.find({
      where,
      order: { createdAt: 'ASC' },
    })

    return {
      message: `Pending leave requests for manager_id ${managerId}'s team`,
      data: pendingRequests.map(lr => this.formatLeaveRequest(lr)),
    }
  }

  async getAllLeaveRequests(
    token: TokenPayload | undefined,
    query: Record<string, unknown>
  ): Promise<ServiceResult> {
    const isAdmin = token?.role === RoleType.Admin
    const { employee_id, manager_id } = query

    if (!isAdmin) {
      const managerId = token?.id
      const team = await this.userRepo.find({ where: { managerId } })
      if (team.length === 0) {
        return { message: 'No team members assigned to your account', data: [] }
      }
      const teamIds = team.map(u => u.id)
      const requests = await this.leaveRepo.find({
        where: { userId: In(teamIds) },
        order: { createdAt: 'DESC' },
      })
      return {
        message: 'Leave requests for your team',
        data: requests.map(lr => this.formatLeaveRequest(lr)),
      }
    }

    if (employee_id !== undefined && manager_id !== undefined) {
      throw new AppError(
        'Provide either employee_id or manager_id, not both',
        StatusCodes.BAD_REQUEST
      )
    }

    if (employee_id !== undefined) {
      const id = parseInt(employee_id as string, 10)
      if (isNaN(id)) throw new AppError('Invalid employee_id', StatusCodes.BAD_REQUEST)
      const user = await this.userRepo.findOne({ where: { id } })
      if (!user) throw new AppError('Employee not found', StatusCodes.BAD_REQUEST)
      const requests = await this.leaveRepo.find({
        where: { userId: id },
        order: { createdAt: 'DESC' },
      })
      return {
        message: `Leave requests for employee_id ${id}`,
        data: requests.map(lr => this.formatLeaveRequest(lr)),
      }
    }

    if (manager_id !== undefined) {
      const id = parseInt(manager_id as string, 10)
      if (isNaN(id)) throw new AppError('Invalid manager_id', StatusCodes.BAD_REQUEST)
      const manager = await this.userRepo.findOne({ where: { id } })
      if (!manager) throw new AppError('Manager not found', StatusCodes.BAD_REQUEST)
      const team = await this.userRepo.find({ where: { managerId: id } })
      if (team.length === 0) {
        return {
          message: `No team members assigned to manager_id ${id}`,
          data: [],
        }
      }
      const teamIds = team.map(u => u.id)
      const requests = await this.leaveRepo.find({
        where: { userId: In(teamIds) },
        order: { createdAt: 'DESC' },
      })
      return {
        message: `Leave requests for manager_id ${id}'s team`,
        data: requests.map(lr => this.formatLeaveRequest(lr)),
      }
    }

    const requests = await this.leaveRepo.find({ order: { createdAt: 'DESC' } })
    return {
      message: 'All leave requests',
      data: requests.map(lr => this.formatLeaveRequest(lr)),
    }
  }

  async getTeamUtilisationReport(
    token: TokenPayload | undefined,
    managerId: number
  ): Promise<ServiceResult> {
    if (isNaN(managerId)) {
      throw new AppError('Invalid manager ID', StatusCodes.BAD_REQUEST)
    }

    const isAdmin = token?.role === RoleType.Admin
    if (!isAdmin && token?.id !== managerId) {
      throw new AppError('You can only view utilisation for your own team', StatusCodes.FORBIDDEN)
    }

    const manager = await this.userRepo.findOne({ where: { id: managerId } })
    if (!manager) {
      throw new AppError('Invalid manager ID', StatusCodes.BAD_REQUEST)
    }

    const team = await this.userRepo.find({ where: { managerId } })
    const data = await Promise.all(
      team.map(async member => {
        const usedDays = await this.getUsedDays(member.id)
        const utilisationPercent =
          member.annualLeaveAllowance > 0 ?
            Math.round((usedDays / member.annualLeaveAllowance) * 100)
          : 0
        return {
          employee_id: member.id,
          name: `${member.firstName} ${member.lastName}`,
          annual_allowance: member.annualLeaveAllowance,
          days_used: usedDays,
          days_remaining: member.annualLeaveAllowance - usedDays,
          utilisation_percent: utilisationPercent,
        }
      })
    )

    return { message: `Team utilisation report for manager_id ${managerId}`, data }
  }

  async getStatusBreakdownReport(query: Record<string, unknown>): Promise<ServiceResult> {
    const { department_id } = query
    const { start, end } = this.getBusinessYear()

    let userIds: Array<number> | undefined
    let scope: string

    if (department_id !== undefined) {
      const deptId = parseInt(department_id as string, 10)
      if (isNaN(deptId)) throw new AppError('Invalid department_id', StatusCodes.BAD_REQUEST)
      const deptUsers = await this.userRepo.find({ where: { departmentId: deptId } })
      userIds = deptUsers.map(u => u.id)
      scope = `department ${deptId}`
    } else {
      scope = 'company-wide'
    }

    const totals: Record<string, number> = {
      Pending: 0,
      Approved: 0,
      Rejected: 0,
      Cancelled: 0,
    }

    if (userIds !== undefined && userIds.length === 0) {
      return {
        message: 'Status breakdown report',
        data: { scope, totals },
      }
    }

    const where: FindOptionsWhere<LeaveRequest> = { startDate: Between(start, end) }
    if (userIds !== undefined) where.userId = In(userIds)

    const allRequests = await this.leaveRepo.find({ where })
    for (const lr of allRequests) {
      if (lr.status in totals) totals[lr.status]++
    }

    return {
      message: 'Status breakdown report',
      data: { scope, totals },
    }
  }
}
