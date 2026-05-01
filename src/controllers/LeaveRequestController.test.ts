import type { Response } from 'express'
import { StatusCodes } from 'http-status-codes'
import { mock } from 'jest-mock-extended'
import type { Repository, SelectQueryBuilder } from 'typeorm'
import { LeaveRequestController } from './LeaveRequestController'
import { LeaveRequest } from '../entities/LeaveRequest.entity'
import { User } from '../entities/User.entity'
import { LeaveStatus, LeaveType, RoleType } from '../enums/index'
import type { AuthenticatedJWTRequest as Request } from '../interfaces/AuthenticatedJWTRequest.interface'
import { ResponseHandler } from '../helpers/ResponseHandler'

jest.mock('../helpers/ResponseHandler')
jest.mock('../helpers/Logger')
jest.mock('class-validator', () => ({
  ...jest.requireActual('class-validator'),
  validate: jest.fn().mockResolvedValue([]),
}))

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeAuthRequest<P extends Record<string, string> = Record<string, string>>(opts: {
  id?: number
  role?: RoleType
  params?: P
  body?: Record<string, unknown>
  query?: Record<string, unknown>
}): Request & { params: P } {
  return {
    signedInUser: { token: { id: opts.id ?? 1, role: opts.role ?? RoleType.Employee } },
    params: opts.params ?? {},
    body: opts.body ?? {},
    query: opts.query ?? {},
  } as unknown as Request & { params: P }
}

function mockResponse(): Response {
  const res = {} as Response
  res.status = jest.fn().mockReturnValue(res)
  res.json = jest.fn().mockReturnValue(res)
  return res
}

function makeUser(overrides: Partial<User> = {}): User {
  return Object.assign(new User(), {
    id: 1,
    firstName: 'Alice',
    lastName: 'Smith',
    email: 'alice@company.com',
    role: RoleType.Employee,
    annualLeaveAllowance: 25,
    managerId: null,
    departmentId: 1,
    ...overrides,
  })
}

function makeLeaveRequest(overrides: Partial<LeaveRequest> = {}): LeaveRequest {
  return Object.assign(new LeaveRequest(), {
    id: 1,
    userId: 1,
    leaveType: LeaveType.Vacation,
    startDate: new Date('2026-09-01'),
    endDate: new Date('2026-09-05'),
    daysRequested: 5,
    status: LeaveStatus.Pending,
    reason: null,
    managerNote: null,
    createdAt: new Date('2026-08-01'),
    ...overrides,
  })
}

// ── Setup ────────────────────────────────────────────────────────────────────

describe('LeaveRequestController', () => {
  let userRepo: ReturnType<typeof mock<Repository<User>>>
  let leaveRepo: ReturnType<typeof mock<Repository<LeaveRequest>>>
  let controller: LeaveRequestController
  let qb: ReturnType<typeof mock<SelectQueryBuilder<LeaveRequest>>>

  beforeEach(() => {
    jest.clearAllMocks()
    userRepo = mock<Repository<User>>()
    leaveRepo = mock<Repository<LeaveRequest>>()
    controller = new LeaveRequestController(userRepo, leaveRepo)

    qb = mock<SelectQueryBuilder<LeaveRequest>>()
    qb.where.mockReturnValue(qb)
    qb.andWhere.mockReturnValue(qb)
    qb.getOne.mockResolvedValue(null)
    leaveRepo.createQueryBuilder.mockReturnValue(qb)
    ;(leaveRepo.create as jest.Mock).mockImplementation((data: Partial<LeaveRequest>) =>
      Object.assign(new LeaveRequest(), data)
    )
  })

  // ── createLeaveRequest ──────────────────────────────────────────────────────

  describe('createLeaveRequest', () => {
    it('returns BAD_REQUEST when admin provides invalid employee_id', async () => {
      const req = makeAuthRequest({
        role: RoleType.Admin,
        body: { employee_id: 'abc', start_date: '2026-09-01', end_date: '2026-09-05', leave_type: LeaveType.Vacation },
      })
      const res = mockResponse()

      await controller.createLeaveRequest(req, res)

      expect(ResponseHandler.sendErrorResponse).toHaveBeenCalledWith(
        res, StatusCodes.BAD_REQUEST, 'Invalid employee ID'
      )
    })

    it('returns BAD_REQUEST when non-admin has no id in token', async () => {
      const req = makeAuthRequest({
        id: 0,  // falsy id triggers the !employee_id check
        role: RoleType.Employee,
        body: { start_date: '2026-09-01', end_date: '2026-09-05', leave_type: LeaveType.Vacation },
      })
      const res = mockResponse()

      await controller.createLeaveRequest(req, res)

      expect(ResponseHandler.sendErrorResponse).toHaveBeenCalledWith(
        res, StatusCodes.BAD_REQUEST, 'Invalid employee ID'
      )
    })

    it('returns BAD_REQUEST when start_date is missing', async () => {
      const req = makeAuthRequest({
        body: { end_date: '2026-09-05', leave_type: LeaveType.Vacation },
      })
      const res = mockResponse()

      await controller.createLeaveRequest(req, res)

      expect(ResponseHandler.sendErrorResponse).toHaveBeenCalledWith(
        res, StatusCodes.BAD_REQUEST, 'start_date and end_date are required'
      )
    })

    it('returns BAD_REQUEST when end_date is missing', async () => {
      const req = makeAuthRequest({
        body: { start_date: '2026-09-01', leave_type: LeaveType.Vacation },
      })
      const res = mockResponse()

      await controller.createLeaveRequest(req, res)

      expect(ResponseHandler.sendErrorResponse).toHaveBeenCalledWith(
        res, StatusCodes.BAD_REQUEST, 'start_date and end_date are required'
      )
    })

    it('returns BAD_REQUEST when date format is invalid', async () => {
      const req = makeAuthRequest({
        body: { start_date: 'not-a-date', end_date: '2026-09-05', leave_type: LeaveType.Vacation },
      })
      const res = mockResponse()

      await controller.createLeaveRequest(req, res)

      expect(ResponseHandler.sendErrorResponse).toHaveBeenCalledWith(
        res, StatusCodes.BAD_REQUEST, 'Invalid date format'
      )
    })

    it('returns BAD_REQUEST when end_date is before start_date', async () => {
      const req = makeAuthRequest({
        body: { start_date: '2026-09-10', end_date: '2026-09-05', leave_type: LeaveType.Vacation },
      })
      const res = mockResponse()

      await controller.createLeaveRequest(req, res)

      expect(ResponseHandler.sendErrorResponse).toHaveBeenCalledWith(
        res, StatusCodes.BAD_REQUEST, expect.stringContaining('before the start date')
      )
    })

    it('returns BAD_REQUEST when leave_type is missing', async () => {
      const req = makeAuthRequest({
        body: { start_date: '2026-09-01', end_date: '2026-09-05' },
      })
      const res = mockResponse()

      await controller.createLeaveRequest(req, res)

      expect(ResponseHandler.sendErrorResponse).toHaveBeenCalledWith(
        res, StatusCodes.BAD_REQUEST, 'leave_type is required'
      )
    })

    it('returns BAD_REQUEST when leave_type is not valid', async () => {
      const req = makeAuthRequest({
        body: { start_date: '2026-09-01', end_date: '2026-09-05', leave_type: 'InvalidType' },
      })
      const res = mockResponse()

      await controller.createLeaveRequest(req, res)

      expect(ResponseHandler.sendErrorResponse).toHaveBeenCalledWith(
        res, StatusCodes.BAD_REQUEST, expect.stringContaining('Invalid leave_type')
      )
    })

    it('returns BAD_REQUEST when employee is not found', async () => {
      userRepo.findOne.mockResolvedValue(null)
      const req = makeAuthRequest({
        body: { start_date: '2026-09-01', end_date: '2026-09-05', leave_type: LeaveType.Vacation },
      })
      const res = mockResponse()

      await controller.createLeaveRequest(req, res)

      expect(ResponseHandler.sendErrorResponse).toHaveBeenCalledWith(
        res, StatusCodes.BAD_REQUEST, 'Invalid employee ID'
      )
    })

    it('returns BAD_REQUEST when days exceed allowance', async () => {
      userRepo.findOne.mockResolvedValue(makeUser({ annualLeaveAllowance: 5 }))
      leaveRepo.find.mockResolvedValue([makeLeaveRequest({ daysRequested: 4 })])
      const req = makeAuthRequest({
        body: { start_date: '2026-09-01', end_date: '2026-09-05', leave_type: LeaveType.Vacation },
      })
      const res = mockResponse()

      await controller.createLeaveRequest(req, res)

      expect(ResponseHandler.sendErrorResponse).toHaveBeenCalledWith(
        res, StatusCodes.BAD_REQUEST, 'Days requested exceed remaining balance'
      )
    })

    it('returns CONFLICT when dates overlap with existing request', async () => {
      userRepo.findOne.mockResolvedValue(makeUser({ annualLeaveAllowance: 25 }))
      leaveRepo.find.mockResolvedValue([])
      qb.getOne.mockResolvedValue(makeLeaveRequest())
      const req = makeAuthRequest({
        body: { start_date: '2026-09-01', end_date: '2026-09-05', leave_type: LeaveType.Vacation },
      })
      const res = mockResponse()

      await controller.createLeaveRequest(req, res)

      expect(ResponseHandler.sendErrorResponse).toHaveBeenCalledWith(
        res, StatusCodes.CONFLICT, 'Date range of request overlaps with existing request'
      )
    })

    it('returns CREATED on happy path', async () => {
      const user = makeUser({ annualLeaveAllowance: 25 })
      userRepo.findOne.mockResolvedValue(user)
      leaveRepo.find.mockResolvedValue([])
      qb.getOne.mockResolvedValue(null)
      const saved = makeLeaveRequest({ status: LeaveStatus.Pending })
      leaveRepo.save.mockResolvedValue(saved)
      const req = makeAuthRequest({
        body: { start_date: '2026-09-01', end_date: '2026-09-05', leave_type: LeaveType.Vacation },
      })
      const res = mockResponse()

      await controller.createLeaveRequest(req, res)

      expect(leaveRepo.save).toHaveBeenCalled()
      expect(res.status).toHaveBeenCalledWith(StatusCodes.CREATED)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Leave request has been submitted for review' })
      )
    })
  })

  // ── deleteLeaveRequest ──────────────────────────────────────────────────────

  describe('deleteLeaveRequest', () => {
    it('returns BAD_REQUEST when employee_id is invalid', async () => {
      const req = makeAuthRequest({ body: { employee_id: 'abc', leave_request_id: 1 } })
      const res = mockResponse()

      await controller.deleteLeaveRequest(req, res)

      expect(ResponseHandler.sendErrorResponse).toHaveBeenCalledWith(
        res, StatusCodes.BAD_REQUEST, 'Invalid employee ID'
      )
    })

    it('returns BAD_REQUEST when leave_request_id is invalid', async () => {
      const req = makeAuthRequest({ body: { employee_id: 1, leave_request_id: 'abc' } })
      const res = mockResponse()

      await controller.deleteLeaveRequest(req, res)

      expect(ResponseHandler.sendErrorResponse).toHaveBeenCalledWith(
        res, StatusCodes.BAD_REQUEST, 'Invalid leave request ID'
      )
    })

    it('returns BAD_REQUEST when leave request is not found', async () => {
      leaveRepo.findOne.mockResolvedValue(null)
      const req = makeAuthRequest({ body: { employee_id: 1, leave_request_id: 99 } })
      const res = mockResponse()

      await controller.deleteLeaveRequest(req, res)

      expect(ResponseHandler.sendErrorResponse).toHaveBeenCalledWith(
        res, StatusCodes.BAD_REQUEST, 'Invalid leave request ID'
      )
    })

    it('returns FORBIDDEN when leave request belongs to different employee', async () => {
      leaveRepo.findOne.mockResolvedValue(makeLeaveRequest({ userId: 2 }))
      const req = makeAuthRequest({ body: { employee_id: 1, leave_request_id: 1 } })
      const res = mockResponse()

      await controller.deleteLeaveRequest(req, res)

      expect(ResponseHandler.sendErrorResponse).toHaveBeenCalledWith(
        res, StatusCodes.FORBIDDEN, 'Unauthorised'
      )
    })

    it('returns OK and sets status to Cancelled on happy path', async () => {
      const lr = makeLeaveRequest({ userId: 1 })
      leaveRepo.findOne.mockResolvedValue(lr)
      const cancelled = makeLeaveRequest({ status: LeaveStatus.Cancelled, userId: 1 })
      leaveRepo.save.mockResolvedValue(cancelled)
      const req = makeAuthRequest({ body: { employee_id: 1, leave_request_id: 1 } })
      const res = mockResponse()

      await controller.deleteLeaveRequest(req, res)

      expect(leaveRepo.save).toHaveBeenCalled()
      expect(res.status).toHaveBeenCalledWith(StatusCodes.OK)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Leave request has been cancelled' })
      )
    })
  })

  // ── approveLeaveRequest ─────────────────────────────────────────────────────

  describe('approveLeaveRequest', () => {
    it('returns BAD_REQUEST when leave_request_id is invalid', async () => {
      const req = makeAuthRequest({ role: RoleType.Admin, body: { leave_request_id: 'abc' } })
      const res = mockResponse()

      await controller.approveLeaveRequest(req, res)

      expect(ResponseHandler.sendErrorResponse).toHaveBeenCalledWith(
        res, StatusCodes.BAD_REQUEST, 'Invalid leave request ID'
      )
    })

    it('returns BAD_REQUEST when leave request is not found', async () => {
      leaveRepo.findOne.mockResolvedValue(null)
      const req = makeAuthRequest({ role: RoleType.Admin, body: { leave_request_id: 99 } })
      const res = mockResponse()

      await controller.approveLeaveRequest(req, res)

      expect(ResponseHandler.sendErrorResponse).toHaveBeenCalledWith(
        res, StatusCodes.BAD_REQUEST, 'Invalid leave request ID'
      )
    })

    it('returns BAD_REQUEST when leave request is not Pending', async () => {
      leaveRepo.findOne.mockResolvedValue(makeLeaveRequest({ status: LeaveStatus.Approved }))
      const req = makeAuthRequest({ role: RoleType.Admin, body: { leave_request_id: 1 } })
      const res = mockResponse()

      await controller.approveLeaveRequest(req, res)

      expect(ResponseHandler.sendErrorResponse).toHaveBeenCalledWith(
        res, StatusCodes.BAD_REQUEST, 'Invalid leave request ID'
      )
    })

    it('returns FORBIDDEN when manager tries to approve outside their team', async () => {
      leaveRepo.findOne.mockResolvedValue(makeLeaveRequest({ userId: 5 }))
      userRepo.findOne.mockResolvedValue(makeUser({ id: 5, managerId: 99 }))
      const req = makeAuthRequest({ id: 2, role: RoleType.Manager, body: { leave_request_id: 1 } })
      const res = mockResponse()

      await controller.approveLeaveRequest(req, res)

      expect(ResponseHandler.sendErrorResponse).toHaveBeenCalledWith(
        res, StatusCodes.FORBIDDEN, 'You can only approve leave requests for your direct reports'
      )
    })

    it('returns OK on happy path (admin)', async () => {
      leaveRepo.findOne.mockResolvedValue(makeLeaveRequest())
      leaveRepo.save.mockResolvedValue(makeLeaveRequest({ status: LeaveStatus.Approved }))
      const req = makeAuthRequest({ role: RoleType.Admin, body: { leave_request_id: 1 } })
      const res = mockResponse()

      await controller.approveLeaveRequest(req, res)

      expect(leaveRepo.save).toHaveBeenCalled()
      expect(res.status).toHaveBeenCalledWith(StatusCodes.OK)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringContaining('approved') })
      )
    })
  })

  // ── rejectLeaveRequest ──────────────────────────────────────────────────────

  describe('rejectLeaveRequest', () => {
    it('returns BAD_REQUEST when leave_request_id is invalid', async () => {
      const req = makeAuthRequest({ role: RoleType.Admin, body: { leave_request_id: 'abc' } })
      const res = mockResponse()

      await controller.rejectLeaveRequest(req, res)

      expect(ResponseHandler.sendErrorResponse).toHaveBeenCalledWith(
        res, StatusCodes.BAD_REQUEST, 'Invalid leave request ID'
      )
    })

    it('returns BAD_REQUEST when leave request is not found', async () => {
      leaveRepo.findOne.mockResolvedValue(null)
      const req = makeAuthRequest({ role: RoleType.Admin, body: { leave_request_id: 99 } })
      const res = mockResponse()

      await controller.rejectLeaveRequest(req, res)

      expect(ResponseHandler.sendErrorResponse).toHaveBeenCalledWith(
        res, StatusCodes.BAD_REQUEST, 'Invalid leave request ID'
      )
    })

    it('returns BAD_REQUEST when leave request is not Pending', async () => {
      leaveRepo.findOne.mockResolvedValue(makeLeaveRequest({ status: LeaveStatus.Rejected }))
      const req = makeAuthRequest({ role: RoleType.Admin, body: { leave_request_id: 1 } })
      const res = mockResponse()

      await controller.rejectLeaveRequest(req, res)

      expect(ResponseHandler.sendErrorResponse).toHaveBeenCalledWith(
        res, StatusCodes.BAD_REQUEST, 'Invalid leave request ID'
      )
    })

    it('returns FORBIDDEN when manager tries to reject outside their team', async () => {
      leaveRepo.findOne.mockResolvedValue(makeLeaveRequest({ userId: 5 }))
      userRepo.findOne.mockResolvedValue(makeUser({ id: 5, managerId: 99 }))
      const req = makeAuthRequest({ id: 2, role: RoleType.Manager, body: { leave_request_id: 1 } })
      const res = mockResponse()

      await controller.rejectLeaveRequest(req, res)

      expect(ResponseHandler.sendErrorResponse).toHaveBeenCalledWith(
        res, StatusCodes.FORBIDDEN, 'You can only reject leave requests for your direct reports'
      )
    })

    it('returns OK on happy path (admin)', async () => {
      leaveRepo.findOne.mockResolvedValue(makeLeaveRequest())
      leaveRepo.save.mockResolvedValue(makeLeaveRequest({ status: LeaveStatus.Rejected }))
      const req = makeAuthRequest({ role: RoleType.Admin, body: { leave_request_id: 1 } })
      const res = mockResponse()

      await controller.rejectLeaveRequest(req, res)

      expect(leaveRepo.save).toHaveBeenCalled()
      expect(res.status).toHaveBeenCalledWith(StatusCodes.OK)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringContaining('rejected') })
      )
    })
  })

  // ── getLeaveRequestsByEmployee ──────────────────────────────────────────────

  describe('getLeaveRequestsByEmployee', () => {
    it('returns BAD_REQUEST on invalid employee_id', async () => {
      const req = makeAuthRequest({ params: { employee_id: 'abc' } })
      const res = mockResponse()

      await controller.getLeaveRequestsByEmployee(req, res)

      expect(ResponseHandler.sendErrorResponse).toHaveBeenCalledWith(
        res, StatusCodes.BAD_REQUEST, 'Invalid employee ID'
      )
    })

    it('returns FORBIDDEN when employee tries to view another employee', async () => {
      const req = makeAuthRequest({ id: 1, role: RoleType.Employee, params: { employee_id: '7' } })
      const res = mockResponse()

      await controller.getLeaveRequestsByEmployee(req, res)

      expect(ResponseHandler.sendErrorResponse).toHaveBeenCalledWith(
        res, StatusCodes.FORBIDDEN, 'You are not authorised to view leave requests for this employee'
      )
    })

    it('returns BAD_REQUEST when employee is not found', async () => {
      userRepo.findOne.mockResolvedValue(null)
      const req = makeAuthRequest({ id: 1, role: RoleType.Employee, params: { employee_id: '1' } })
      const res = mockResponse()

      await controller.getLeaveRequestsByEmployee(req, res)

      expect(ResponseHandler.sendErrorResponse).toHaveBeenCalledWith(
        res, StatusCodes.BAD_REQUEST, 'Invalid employee ID'
      )
    })

    it('returns OK with formatted leave list', async () => {
      userRepo.findOne.mockResolvedValue(makeUser())
      const leaves = [makeLeaveRequest()]
      leaveRepo.find.mockResolvedValue(leaves)
      const req = makeAuthRequest({ id: 1, role: RoleType.Employee, params: { employee_id: '1' } })
      const res = mockResponse()

      await controller.getLeaveRequestsByEmployee(req, res)

      expect(res.status).toHaveBeenCalledWith(StatusCodes.OK)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringContaining('employee_id 1') })
      )
    })
  })

  // ── getRemainingLeave ───────────────────────────────────────────────────────

  describe('getRemainingLeave', () => {
    it('returns BAD_REQUEST on invalid employee_id', async () => {
      const req = makeAuthRequest({ params: { employee_id: 'abc' } })
      const res = mockResponse()

      await controller.getRemainingLeave(req, res)

      expect(ResponseHandler.sendErrorResponse).toHaveBeenCalledWith(
        res, StatusCodes.BAD_REQUEST, 'Invalid employee ID'
      )
    })

    it('returns FORBIDDEN when employee tries to view another employee', async () => {
      const req = makeAuthRequest({ id: 1, role: RoleType.Employee, params: { employee_id: '9' } })
      const res = mockResponse()

      await controller.getRemainingLeave(req, res)

      expect(ResponseHandler.sendErrorResponse).toHaveBeenCalledWith(
        res, StatusCodes.FORBIDDEN, 'You are not authorised to view leave balance for this employee'
      )
    })

    it('returns OK with leave balance data', async () => {
      userRepo.findOne.mockResolvedValue(makeUser({ annualLeaveAllowance: 25 }))
      leaveRepo.find.mockResolvedValue([makeLeaveRequest({ daysRequested: 5, status: LeaveStatus.Approved })])
      const req = makeAuthRequest({ id: 1, role: RoleType.Employee, params: { employee_id: '1' } })
      const res = mockResponse()

      await controller.getRemainingLeave(req, res)

      expect(res.status).toHaveBeenCalledWith(StatusCodes.OK)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            annual_allowance: 25,
            days_remaining: expect.any(Number),
          }),
        })
      )
    })
  })

  // ── getPendingRequestsByManager ─────────────────────────────────────────────

  describe('getPendingRequestsByManager', () => {
    it('returns BAD_REQUEST when admin provides invalid manager_id', async () => {
      const req = makeAuthRequest({ role: RoleType.Admin, params: { manager_id: 'abc' } })
      const res = mockResponse()

      await controller.getPendingRequestsByManager(req, res)

      expect(ResponseHandler.sendErrorResponse).toHaveBeenCalledWith(
        res, StatusCodes.BAD_REQUEST, 'Invalid manager ID'
      )
    })

    it('returns BAD_REQUEST when manager is not found', async () => {
      userRepo.findOne.mockResolvedValue(null)
      const req = makeAuthRequest({ id: 2, role: RoleType.Manager, params: { manager_id: '2' } })
      const res = mockResponse()

      await controller.getPendingRequestsByManager(req, res)

      expect(ResponseHandler.sendErrorResponse).toHaveBeenCalledWith(
        res, StatusCodes.BAD_REQUEST, 'Invalid manager ID'
      )
    })

    it('returns OK with empty array when manager has no team', async () => {
      userRepo.findOne.mockResolvedValue(makeUser({ id: 2 }))
      userRepo.find.mockResolvedValue([])
      const req = makeAuthRequest({ id: 2, role: RoleType.Manager, params: { manager_id: '2' } })
      const res = mockResponse()

      await controller.getPendingRequestsByManager(req, res)

      expect(res.status).toHaveBeenCalledWith(StatusCodes.OK)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ data: [] })
      )
    })

    it('returns OK with pending requests for the team', async () => {
      userRepo.findOne.mockResolvedValue(makeUser({ id: 2 }))
      userRepo.find.mockResolvedValue([makeUser({ id: 3, managerId: 2 })])
      const pending = makeLeaveRequest({ userId: 3, status: LeaveStatus.Pending })
      leaveRepo.find.mockResolvedValue([pending])
      const req = makeAuthRequest({ id: 2, role: RoleType.Manager, params: { manager_id: '2' } })
      const res = mockResponse()

      await controller.getPendingRequestsByManager(req, res)

      expect(res.status).toHaveBeenCalledWith(StatusCodes.OK)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.arrayContaining([expect.objectContaining({ employee_id: 3 })]) })
      )
    })

    it('returns BAD_REQUEST when from date is invalid', async () => {
      userRepo.findOne.mockResolvedValue(makeUser({ id: 2 }))
      const req = makeAuthRequest({ id: 2, role: RoleType.Manager, params: { manager_id: '2' }, query: { from: 'not-a-date' } })
      const res = mockResponse()

      await controller.getPendingRequestsByManager(req, res)

      expect(ResponseHandler.sendErrorResponse).toHaveBeenCalledWith(
        res, StatusCodes.BAD_REQUEST, 'Invalid from date format'
      )
    })

    it('returns BAD_REQUEST when to date is invalid', async () => {
      userRepo.findOne.mockResolvedValue(makeUser({ id: 2 }))
      const req = makeAuthRequest({ id: 2, role: RoleType.Manager, params: { manager_id: '2' }, query: { to: 'bad' } })
      const res = mockResponse()

      await controller.getPendingRequestsByManager(req, res)

      expect(ResponseHandler.sendErrorResponse).toHaveBeenCalledWith(
        res, StatusCodes.BAD_REQUEST, 'Invalid to date format'
      )
    })

    it('returns BAD_REQUEST when from > to', async () => {
      userRepo.findOne.mockResolvedValue(makeUser({ id: 2 }))
      const req = makeAuthRequest({
        id: 2, role: RoleType.Manager, params: { manager_id: '2' },
        query: { from: '2025-06-01', to: '2025-05-01' },
      })
      const res = mockResponse()

      await controller.getPendingRequestsByManager(req, res)

      expect(ResponseHandler.sendErrorResponse).toHaveBeenCalledWith(
        res, StatusCodes.BAD_REQUEST, 'from date must not be after to date'
      )
    })

    it('returns OK filtered by valid from/to range', async () => {
      userRepo.findOne.mockResolvedValue(makeUser({ id: 2 }))
      userRepo.find.mockResolvedValue([makeUser({ id: 3, managerId: 2 })])
      const pending = makeLeaveRequest({ userId: 3, status: LeaveStatus.Pending })
      leaveRepo.find.mockResolvedValue([pending])
      const req = makeAuthRequest({
        id: 2, role: RoleType.Manager, params: { manager_id: '2' },
        query: { from: '2025-05-01', to: '2025-05-31' },
      })
      const res = mockResponse()

      await controller.getPendingRequestsByManager(req, res)

      expect(res.status).toHaveBeenCalledWith(StatusCodes.OK)
      expect(leaveRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ endDate: expect.anything(), startDate: expect.anything() }) })
      )
    })
  })

  // ── getAllLeaveRequests ──────────────────────────────────────────────────────

  describe('getAllLeaveRequests', () => {
    it('returns team requests for manager (ignores query params)', async () => {
      userRepo.find.mockResolvedValue([makeUser({ id: 3, managerId: 2 })])
      const requests = [makeLeaveRequest({ userId: 3 })]
      leaveRepo.find.mockResolvedValue(requests)
      const req = makeAuthRequest({ id: 2, role: RoleType.Manager, query: { employee_id: '3' } })
      const res = mockResponse()

      await controller.getAllLeaveRequests(req, res)

      expect(res.status).toHaveBeenCalledWith(StatusCodes.OK)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Leave requests for your team' })
      )
    })

    it('returns BAD_REQUEST (admin) when both employee_id and manager_id are provided', async () => {
      const req = makeAuthRequest({ role: RoleType.Admin, query: { employee_id: '1', manager_id: '2' } })
      const res = mockResponse()

      await controller.getAllLeaveRequests(req, res)

      expect(ResponseHandler.sendErrorResponse).toHaveBeenCalledWith(
        res, StatusCodes.BAD_REQUEST, 'Provide either employee_id or manager_id, not both'
      )
    })

    it('returns filtered requests by employee_id (admin)', async () => {
      userRepo.findOne.mockResolvedValue(makeUser())
      const requests = [makeLeaveRequest()]
      leaveRepo.find.mockResolvedValue(requests)
      const req = makeAuthRequest({ role: RoleType.Admin, query: { employee_id: '1' } })
      const res = mockResponse()

      await controller.getAllLeaveRequests(req, res)

      expect(res.status).toHaveBeenCalledWith(StatusCodes.OK)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringContaining('employee_id 1') })
      )
    })

    it('returns filtered requests by manager_id (admin)', async () => {
      userRepo.findOne.mockResolvedValue(makeUser({ id: 2 }))
      userRepo.find.mockResolvedValue([makeUser({ id: 3, managerId: 2 })])
      leaveRepo.find.mockResolvedValue([makeLeaveRequest({ userId: 3 })])
      const req = makeAuthRequest({ role: RoleType.Admin, query: { manager_id: '2' } })
      const res = mockResponse()

      await controller.getAllLeaveRequests(req, res)

      expect(res.status).toHaveBeenCalledWith(StatusCodes.OK)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringContaining("manager_id 2") })
      )
    })

    it('returns all requests when admin provides no filter', async () => {
      leaveRepo.find.mockResolvedValue([makeLeaveRequest(), makeLeaveRequest({ id: 2, userId: 2 })])
      const req = makeAuthRequest({ role: RoleType.Admin })
      const res = mockResponse()

      await controller.getAllLeaveRequests(req, res)

      expect(res.status).toHaveBeenCalledWith(StatusCodes.OK)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'All leave requests' })
      )
    })
  })

  // ── getTeamUtilisationReport ─────────────────────────────────────────────────

  describe('getTeamUtilisationReport', () => {
    it('returns BAD_REQUEST for invalid manager_id', async () => {
      const req = makeAuthRequest({ role: RoleType.Admin, params: { manager_id: 'abc' } })
      const res = mockResponse()

      await controller.getTeamUtilisationReport(req, res)

      expect(ResponseHandler.sendErrorResponse).toHaveBeenCalledWith(
        res, StatusCodes.BAD_REQUEST, 'Invalid manager ID'
      )
    })

    it('returns FORBIDDEN when manager requests another manager\'s team', async () => {
      const req = makeAuthRequest({ id: 2, role: RoleType.Manager, params: { manager_id: '99' } })
      const res = mockResponse()

      await controller.getTeamUtilisationReport(req, res)

      expect(ResponseHandler.sendErrorResponse).toHaveBeenCalledWith(
        res, StatusCodes.FORBIDDEN, 'You can only view utilisation for your own team'
      )
    })

    it('returns BAD_REQUEST when manager not found', async () => {
      userRepo.findOne.mockResolvedValue(null)
      const req = makeAuthRequest({ role: RoleType.Admin, params: { manager_id: '5' } })
      const res = mockResponse()

      await controller.getTeamUtilisationReport(req, res)

      expect(ResponseHandler.sendErrorResponse).toHaveBeenCalledWith(
        res, StatusCodes.BAD_REQUEST, 'Invalid manager ID'
      )
    })

    it('returns OK with empty array when manager has no team', async () => {
      userRepo.findOne.mockResolvedValue(makeUser({ id: 2 }))
      userRepo.find.mockResolvedValue([])
      const req = makeAuthRequest({ role: RoleType.Admin, params: { manager_id: '2' } })
      const res = mockResponse()

      await controller.getTeamUtilisationReport(req, res)

      expect(res.status).toHaveBeenCalledWith(StatusCodes.OK)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ data: [] })
      )
    })

    it('returns OK with utilisation stats for each team member (admin)', async () => {
      userRepo.findOne.mockResolvedValue(makeUser({ id: 2 }))
      const member = makeUser({ id: 3, firstName: 'Bob', lastName: 'Jones', managerId: 2, annualLeaveAllowance: 25 })
      userRepo.find.mockResolvedValue([member])
      // getUsedDays calls leaveRepo.find — return 8 days approved
      const approvedRequest = makeLeaveRequest({ userId: 3, status: LeaveStatus.Approved, daysRequested: 8 })
      leaveRepo.find.mockResolvedValue([approvedRequest])
      const req = makeAuthRequest({ role: RoleType.Admin, params: { manager_id: '2' } })
      const res = mockResponse()

      await controller.getTeamUtilisationReport(req, res)

      expect(res.status).toHaveBeenCalledWith(StatusCodes.OK)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({
              employee_id: 3,
              name: 'Bob Jones',
              annual_allowance: 25,
              days_used: 8,
              days_remaining: 17,
              utilisation_percent: 32,
            }),
          ]),
        })
      )
    })

    it('returns OK when manager requests their own team', async () => {
      userRepo.findOne.mockResolvedValue(makeUser({ id: 2 }))
      userRepo.find.mockResolvedValue([makeUser({ id: 3, managerId: 2 })])
      leaveRepo.find.mockResolvedValue([])
      const req = makeAuthRequest({ id: 2, role: RoleType.Manager, params: { manager_id: '2' } })
      const res = mockResponse()

      await controller.getTeamUtilisationReport(req, res)

      expect(res.status).toHaveBeenCalledWith(StatusCodes.OK)
    })
  })

  // ── getStatusBreakdownReport ──────────────────────────────────────────────────

  describe('getStatusBreakdownReport', () => {
    it('returns BAD_REQUEST when department_id is invalid', async () => {
      const req = makeAuthRequest({ role: RoleType.Admin, query: { department_id: 'xyz' } })
      const res = mockResponse()

      await controller.getStatusBreakdownReport(req, res)

      expect(ResponseHandler.sendErrorResponse).toHaveBeenCalledWith(
        res, StatusCodes.BAD_REQUEST, 'Invalid department_id'
      )
    })

    it('returns OK with zero counts when department has no users', async () => {
      userRepo.find.mockResolvedValue([])
      const req = makeAuthRequest({ role: RoleType.Admin, query: { department_id: '99' } })
      const res = mockResponse()

      await controller.getStatusBreakdownReport(req, res)

      expect(res.status).toHaveBeenCalledWith(StatusCodes.OK)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            scope: 'department 99',
            totals: { Pending: 0, Approved: 0, Rejected: 0, Cancelled: 0 },
          }),
        })
      )
    })

    it('returns OK company-wide breakdown with correct counts', async () => {
      leaveRepo.find.mockResolvedValue([
        makeLeaveRequest({ status: LeaveStatus.Approved }),
        makeLeaveRequest({ id: 2, status: LeaveStatus.Approved }),
        makeLeaveRequest({ id: 3, status: LeaveStatus.Pending }),
        makeLeaveRequest({ id: 4, status: LeaveStatus.Rejected }),
        makeLeaveRequest({ id: 5, status: LeaveStatus.Cancelled }),
      ])
      const req = makeAuthRequest({ role: RoleType.Admin })
      const res = mockResponse()

      await controller.getStatusBreakdownReport(req, res)

      expect(res.status).toHaveBeenCalledWith(StatusCodes.OK)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            scope: 'company-wide',
            totals: { Pending: 1, Approved: 2, Rejected: 1, Cancelled: 1 },
          }),
        })
      )
    })

    it('returns OK scoped to a department with correct counts', async () => {
      userRepo.find.mockResolvedValue([makeUser({ id: 5, departmentId: 3 })])
      leaveRepo.find.mockResolvedValue([
        makeLeaveRequest({ userId: 5, status: LeaveStatus.Approved }),
        makeLeaveRequest({ id: 2, userId: 5, status: LeaveStatus.Pending }),
      ])
      const req = makeAuthRequest({ role: RoleType.Admin, query: { department_id: '3' } })
      const res = mockResponse()

      await controller.getStatusBreakdownReport(req, res)

      expect(res.status).toHaveBeenCalledWith(StatusCodes.OK)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            scope: 'department 3',
            totals: expect.objectContaining({ Approved: 1, Pending: 1 }),
          }),
        })
      )
    })

    it('includes business_year in the response', async () => {
      leaveRepo.find.mockResolvedValue([])
      const req = makeAuthRequest({ role: RoleType.Admin })
      const res = mockResponse()

      await controller.getStatusBreakdownReport(req, res)

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            business_year: expect.stringMatching(/^\d{4}-\d{2}-\d{2} to \d{4}-\d{2}-\d{2}$/),
          }),
        })
      )
    })
  })
})
