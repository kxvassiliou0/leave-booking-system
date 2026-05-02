import { mock, MockProxy } from 'jest-mock-extended'
import { StatusCodes } from 'http-status-codes'
import type { Repository, SelectQueryBuilder } from 'typeorm'
import { LeaveRequestService } from './LeaveRequestService'
import { AppError } from '../helpers/AppError'
import { makeLeaveRequest, makeUser } from '../test/ObjectMother'
import { LeaveRequest } from '../entities/LeaveRequest.entity'
import { User } from '../entities/User.entity'
import { LeaveStatus, LeaveType, RoleType } from '../enums/index'

let mockUserRepo: MockProxy<Repository<User>>
let mockLeaveRepo: MockProxy<Repository<LeaveRequest>>
let service: LeaveRequestService

beforeEach(() => {
  mockUserRepo = mock<Repository<User>>()
  mockLeaveRepo = mock<Repository<LeaveRequest>>()
  service = new LeaveRequestService(mockUserRepo, mockLeaveRepo)
  jest.clearAllMocks()
})

const mockQBNoOverlap = (): SelectQueryBuilder<LeaveRequest> =>
  ({
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockResolvedValue(null),
  }) as unknown as SelectQueryBuilder<LeaveRequest>

describe('LeaveRequestService.createLeaveRequest', () => {
  it('throws BAD_REQUEST when start_date or end_date is missing', async () => {
    // Arrange
    const token = { id: 4, role: RoleType.Employee }

    // Act & Assert
    await expect(
      service.createLeaveRequest(token, { leave_type: 'Vacation' })
    ).rejects.toThrow(new AppError('start_date and end_date are required', StatusCodes.BAD_REQUEST))
  })

  it('throws BAD_REQUEST when end_date is before start_date', async () => {
    // Arrange
    const token = { id: 4, role: RoleType.Employee }

    // Act & Assert
    await expect(
      service.createLeaveRequest(token, {
        leave_type: 'Vacation',
        start_date: '2026-09-05',
        end_date: '2026-09-01',
      })
    ).rejects.toThrow(AppError)
  })

  it('throws BAD_REQUEST when leave_type is invalid', async () => {
    // Arrange
    const token = { id: 4, role: RoleType.Employee }

    // Act & Assert
    await expect(
      service.createLeaveRequest(token, {
        leave_type: 'InvalidType',
        start_date: '2026-09-01',
        end_date: '2026-09-05',
      })
    ).rejects.toThrow(AppError)
  })

  it('throws BAD_REQUEST when employee does not exist', async () => {
    // Arrange
    const token = { id: 4, role: RoleType.Employee }
    mockUserRepo.findOne.mockResolvedValue(null)

    // Act & Assert
    await expect(
      service.createLeaveRequest(token, {
        leave_type: 'Vacation',
        start_date: '2026-09-01',
        end_date: '2026-09-05',
      })
    ).rejects.toThrow(new AppError('Invalid employee ID', StatusCodes.BAD_REQUEST))
  })

  it('throws BAD_REQUEST when days requested exceed remaining allowance', async () => {
    // Arrange
    const token = { id: 4, role: RoleType.Employee }
    const user = makeUser({ id: 4, annualLeaveAllowance: 5 })
    mockUserRepo.findOne.mockResolvedValue(user)
    mockLeaveRepo.find.mockResolvedValue([])

    // Act & Assert
    await expect(
      service.createLeaveRequest(token, {
        leave_type: 'Vacation',
        start_date: '2026-09-01',
        end_date: '2026-09-10',
      })
    ).rejects.toThrow(new AppError('Days requested exceed remaining balance', StatusCodes.BAD_REQUEST))
  })

  it('throws CONFLICT when dates overlap with existing request', async () => {
    // Arrange
    const token = { id: 4, role: RoleType.Employee }
    const user = makeUser({ id: 4, annualLeaveAllowance: 25 })
    mockUserRepo.findOne.mockResolvedValue(user)
    mockLeaveRepo.find.mockResolvedValue([])
    const mockQB = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(makeLeaveRequest()),
    } as unknown as SelectQueryBuilder<LeaveRequest>
    mockLeaveRepo.createQueryBuilder.mockReturnValue(mockQB)

    // Act & Assert
    await expect(
      service.createLeaveRequest(token, {
        leave_type: 'Vacation',
        start_date: '2026-09-01',
        end_date: '2026-09-05',
      })
    ).rejects.toThrow(
      new AppError('Date range of request overlaps with existing request', StatusCodes.CONFLICT)
    )
  })

  it('creates and returns the leave request on success', async () => {
    // Arrange
    const token = { id: 4, role: RoleType.Employee }
    const user = makeUser({ id: 4, annualLeaveAllowance: 25 })
    const saved = makeLeaveRequest({ userId: 4 })
    mockUserRepo.findOne.mockResolvedValue(user)
    mockLeaveRepo.find.mockResolvedValue([])
    mockLeaveRepo.createQueryBuilder.mockReturnValue(mockQBNoOverlap())
    mockLeaveRepo.create.mockReturnValue(saved)
    mockLeaveRepo.save.mockResolvedValue(saved)

    // Act
    const result = await service.createLeaveRequest(token, {
      leave_type: LeaveType.Vacation,
      start_date: '2026-09-01',
      end_date: '2026-09-05',
    })

    // Assert
    expect(result.message).toContain('submitted for review')
    expect(mockLeaveRepo.save).toHaveBeenCalledTimes(1)
  })

  it('creates leave request as admin on behalf of an employee', async () => {
    // Arrange
    const token = { id: 1, role: RoleType.Admin }
    const user = makeUser({ id: 4, annualLeaveAllowance: 25 })
    const saved = makeLeaveRequest({ userId: 4 })
    mockUserRepo.findOne.mockResolvedValue(user)
    mockLeaveRepo.find.mockResolvedValue([])
    mockLeaveRepo.createQueryBuilder.mockReturnValue(mockQBNoOverlap())
    mockLeaveRepo.create.mockReturnValue(saved)
    mockLeaveRepo.save.mockResolvedValue(saved)

    // Act
    const result = await service.createLeaveRequest(token, {
      employee_id: 4,
      leave_type: LeaveType.Vacation,
      start_date: '2026-09-01',
      end_date: '2026-09-05',
    })

    // Assert
    expect(result.message).toContain('submitted for review')
  })
})

describe('LeaveRequestService.deleteLeaveRequest', () => {
  it('throws BAD_REQUEST when employee_id is missing from token and body', async () => {
    // Arrange — undefined token yields no employee_id

    // Act & Assert
    await expect(service.deleteLeaveRequest(undefined, {})).rejects.toThrow(
      new AppError('Invalid employee ID', StatusCodes.BAD_REQUEST)
    )
  })

  it('throws BAD_REQUEST when leave_request_id is missing', async () => {
    // Arrange
    const token = { id: 4, role: RoleType.Employee }

    // Act & Assert
    await expect(service.deleteLeaveRequest(token, {})).rejects.toThrow(
      new AppError('Invalid leave request ID', StatusCodes.BAD_REQUEST)
    )
  })

  it('throws BAD_REQUEST when leave request does not exist', async () => {
    // Arrange
    const token = { id: 4, role: RoleType.Employee }
    mockLeaveRepo.findOne.mockResolvedValue(null)

    // Act & Assert
    await expect(
      service.deleteLeaveRequest(token, { leave_request_id: 99 })
    ).rejects.toThrow(new AppError('Invalid leave request ID', StatusCodes.BAD_REQUEST))
  })

  it('throws FORBIDDEN when leave request belongs to a different employee', async () => {
    // Arrange
    const lr = makeLeaveRequest({ userId: 5 })
    mockLeaveRepo.findOne.mockResolvedValue(lr)

    // Act & Assert
    await expect(
      service.deleteLeaveRequest({ id: 4, role: RoleType.Employee }, { leave_request_id: 1 })
    ).rejects.toThrow(new AppError('Unauthorised', StatusCodes.FORBIDDEN))
  })

  it('cancels the leave request as the owning employee', async () => {
    // Arrange
    const token = { id: 4, role: RoleType.Employee }
    const lr = makeLeaveRequest({ userId: 4, status: LeaveStatus.Pending })
    mockLeaveRepo.findOne.mockResolvedValue(lr)
    mockLeaveRepo.save.mockResolvedValue({ ...lr, status: LeaveStatus.Cancelled })

    // Act
    const result = await service.deleteLeaveRequest(token, { leave_request_id: 1 })

    // Assert
    expect(result.message).toBe('Leave request has been cancelled')
  })

  it('cancels an approved leave request and returns days_restored in response', async () => {
    // Arrange
    const token = { id: 4, role: RoleType.Employee }
    const lr = makeLeaveRequest({ userId: 4, status: LeaveStatus.Approved, daysRequested: 5 })
    const user = makeUser({ id: 4, annualLeaveAllowance: 25 })
    mockLeaveRepo.findOne.mockResolvedValue(lr)
    mockLeaveRepo.save.mockResolvedValue({ ...lr, status: LeaveStatus.Cancelled })
    mockUserRepo.findOne.mockResolvedValue(user)
    mockLeaveRepo.find.mockResolvedValue([])

    // Act
    const result = await service.deleteLeaveRequest(token, { leave_request_id: 1 })

    // Assert
    expect(result.message).toContain('5 day(s) have been restored')
    expect(result.data).toMatchObject({ days_restored: 5, new_days_remaining: 25 })
  })

  it('throws BAD_REQUEST when cancelling an already cancelled request', async () => {
    // Arrange
    const token = { id: 4, role: RoleType.Employee }
    const lr = makeLeaveRequest({ userId: 4, status: LeaveStatus.Cancelled })
    mockLeaveRepo.findOne.mockResolvedValue(lr)

    // Act & Assert
    await expect(
      service.deleteLeaveRequest(token, { leave_request_id: 1 })
    ).rejects.toThrow(new AppError('Leave request is already cancelled', StatusCodes.BAD_REQUEST))
  })

  it('throws BAD_REQUEST when cancelling a rejected request', async () => {
    // Arrange
    const token = { id: 4, role: RoleType.Employee }
    const lr = makeLeaveRequest({ userId: 4, status: LeaveStatus.Rejected })
    mockLeaveRepo.findOne.mockResolvedValue(lr)

    // Act & Assert
    await expect(
      service.deleteLeaveRequest(token, { leave_request_id: 1 })
    ).rejects.toThrow(new AppError('Cannot cancel a rejected leave request', StatusCodes.BAD_REQUEST))
  })
})

describe('LeaveRequestService.approveLeaveRequest', () => {
  it('throws BAD_REQUEST when leave request does not exist', async () => {
    // Arrange
    const token = { id: 1, role: RoleType.Admin }
    mockLeaveRepo.findOne.mockResolvedValue(null)

    // Act & Assert
    await expect(
      service.approveLeaveRequest(token, { leave_request_id: 999 })
    ).rejects.toThrow(new AppError('Invalid leave request ID', StatusCodes.BAD_REQUEST))
  })

  it('throws BAD_REQUEST when leave request is not pending', async () => {
    // Arrange
    const token = { id: 2, role: RoleType.Manager }
    const lr = makeLeaveRequest({ status: LeaveStatus.Approved })
    mockLeaveRepo.findOne.mockResolvedValue(lr)

    // Act & Assert
    await expect(
      service.approveLeaveRequest(token, { leave_request_id: 1 })
    ).rejects.toThrow(new AppError('Invalid leave request ID', StatusCodes.BAD_REQUEST))
  })

  it('throws FORBIDDEN when manager tries to approve outside their team', async () => {
    // Arrange
    const token = { id: 2, role: RoleType.Manager }
    const lr = makeLeaveRequest({ userId: 6, status: LeaveStatus.Pending })
    const employee = makeUser({ id: 6, managerId: 3 })
    mockLeaveRepo.findOne.mockResolvedValue(lr)
    mockUserRepo.findOne.mockResolvedValue(employee)

    // Act & Assert
    await expect(
      service.approveLeaveRequest(token, { leave_request_id: 1 })
    ).rejects.toThrow(
      new AppError(
        'You can only approve leave requests for your direct reports',
        StatusCodes.FORBIDDEN
      )
    )
  })

  it('approves leave request as admin', async () => {
    // Arrange
    const token = { id: 1, role: RoleType.Admin }
    const lr = makeLeaveRequest({ userId: 4, status: LeaveStatus.Pending })
    mockLeaveRepo.findOne.mockResolvedValue(lr)
    mockLeaveRepo.save.mockResolvedValue({ ...lr, status: LeaveStatus.Approved })

    // Act
    const result = await service.approveLeaveRequest(token, {
      leave_request_id: 1,
      reason: 'Approved — enjoy your time off!',
    })

    // Assert
    expect(result.message).toContain('approved')
    expect(mockLeaveRepo.save).toHaveBeenCalledTimes(1)
  })

  it('approves leave request as the direct-report manager', async () => {
    // Arrange
    const token = { id: 2, role: RoleType.Manager }
    const lr = makeLeaveRequest({ userId: 4, status: LeaveStatus.Pending })
    const employee = makeUser({ id: 4, managerId: 2 })
    mockLeaveRepo.findOne.mockResolvedValue(lr)
    mockUserRepo.findOne.mockResolvedValue(employee)
    mockLeaveRepo.save.mockResolvedValue({ ...lr, status: LeaveStatus.Approved })

    // Act
    const result = await service.approveLeaveRequest(token, { leave_request_id: 1 })

    // Assert
    expect(result.message).toContain('approved')
  })
})

describe('LeaveRequestService.rejectLeaveRequest', () => {
  it('throws BAD_REQUEST when leave request is not pending', async () => {
    // Arrange
    const token = { id: 2, role: RoleType.Manager }
    const lr = makeLeaveRequest({ status: LeaveStatus.Approved })
    mockLeaveRepo.findOne.mockResolvedValue(lr)

    // Act & Assert
    await expect(
      service.rejectLeaveRequest(token, { leave_request_id: 1 })
    ).rejects.toThrow(new AppError('Invalid leave request ID', StatusCodes.BAD_REQUEST))
  })

  it('throws FORBIDDEN when manager tries to reject outside their team', async () => {
    // Arrange
    const token = { id: 2, role: RoleType.Manager }
    const lr = makeLeaveRequest({ userId: 6, status: LeaveStatus.Pending })
    const employee = makeUser({ id: 6, managerId: 3 })
    mockLeaveRepo.findOne.mockResolvedValue(lr)
    mockUserRepo.findOne.mockResolvedValue(employee)

    // Act & Assert
    await expect(
      service.rejectLeaveRequest(token, { leave_request_id: 1 })
    ).rejects.toThrow(
      new AppError(
        'You can only reject leave requests for your direct reports',
        StatusCodes.FORBIDDEN
      )
    )
  })

  it('rejects leave request as admin', async () => {
    // Arrange
    const token = { id: 1, role: RoleType.Admin }
    const lr = makeLeaveRequest({ userId: 4, status: LeaveStatus.Pending })
    mockLeaveRepo.findOne.mockResolvedValue(lr)
    mockLeaveRepo.save.mockResolvedValue({ ...lr, status: LeaveStatus.Rejected })

    // Act
    const result = await service.rejectLeaveRequest(token, {
      leave_request_id: 1,
      reason: 'Team at capacity',
    })

    // Assert
    expect(result.message).toContain('rejected')
    expect(mockLeaveRepo.save).toHaveBeenCalledTimes(1)
  })
})

describe('LeaveRequestService.getLeaveRequestsByEmployee', () => {
  it('throws FORBIDDEN when employee requests another employee data', async () => {
    // Arrange
    const token = { id: 4, role: RoleType.Employee }

    // Act & Assert
    await expect(service.getLeaveRequestsByEmployee(token, 5)).rejects.toThrow(
      new AppError(
        'You are not authorised to view leave requests for this employee',
        StatusCodes.FORBIDDEN
      )
    )
  })

  it('throws BAD_REQUEST when employee does not exist', async () => {
    // Arrange
    const token = { id: 1, role: RoleType.Admin }
    mockUserRepo.findOne.mockResolvedValue(null)

    // Act & Assert
    await expect(service.getLeaveRequestsByEmployee(token, 99)).rejects.toThrow(
      new AppError('Invalid employee ID', StatusCodes.BAD_REQUEST)
    )
  })

  it('returns leave requests for the employee', async () => {
    // Arrange
    const token = { id: 4, role: RoleType.Employee }
    mockUserRepo.findOne.mockResolvedValue(makeUser({ id: 4 }))
    mockLeaveRepo.find.mockResolvedValue([makeLeaveRequest({ userId: 4 })])

    // Act
    const result = await service.getLeaveRequestsByEmployee(token, 4)

    // Assert
    expect(result.message).toContain('4')
    expect(Array.isArray(result.data)).toBe(true)
  })
})

describe('LeaveRequestService.getRemainingLeave', () => {
  it('throws FORBIDDEN when employee requests another employee balance', async () => {
    // Arrange
    const token = { id: 4, role: RoleType.Employee }

    // Act & Assert
    await expect(service.getRemainingLeave(token, 5)).rejects.toThrow(
      new AppError(
        'You are not authorised to view leave balance for this employee',
        StatusCodes.FORBIDDEN
      )
    )
  })

  it('returns remaining leave balance for the employee', async () => {
    // Arrange
    const token = { id: 4, role: RoleType.Employee }
    mockUserRepo.findOne.mockResolvedValue(makeUser({ id: 4, annualLeaveAllowance: 25 }))
    mockLeaveRepo.find.mockResolvedValue([])

    // Act
    const result = await service.getRemainingLeave(token, 4)

    // Assert
    expect(result.data).toMatchObject({ annual_allowance: 25, days_remaining: 25 })
  })
})

describe('LeaveRequestService.getPendingRequestsByManager', () => {
  it('returns empty data when manager has no team members', async () => {
    // Arrange
    const token = { id: 2, role: RoleType.Manager }
    mockUserRepo.findOne.mockResolvedValue(makeUser({ id: 2 }))
    mockUserRepo.find.mockResolvedValue([])

    // Act
    const result = await service.getPendingRequestsByManager(token, 2, {})

    // Assert
    expect(result.data).toEqual([])
  })

  it('returns pending requests for the manager team', async () => {
    // Arrange
    const token = { id: 2, role: RoleType.Manager }
    mockUserRepo.findOne.mockResolvedValue(makeUser({ id: 2 }))
    mockUserRepo.find.mockResolvedValue([makeUser({ id: 4, managerId: 2 })])
    mockLeaveRepo.find.mockResolvedValue([makeLeaveRequest({ userId: 4 })])

    // Act
    const result = await service.getPendingRequestsByManager(token, 2, {})

    // Assert
    expect(result.message).toContain('2')
    expect(Array.isArray(result.data)).toBe(true)
  })

  it('throws BAD_REQUEST when manager does not exist', async () => {
    // Arrange
    const token = { id: 2, role: RoleType.Manager }
    mockUserRepo.findOne.mockResolvedValue(null)

    // Act & Assert
    await expect(service.getPendingRequestsByManager(token, 2, {})).rejects.toThrow(
      new AppError('Invalid manager ID', StatusCodes.BAD_REQUEST)
    )
  })

  it('throws BAD_REQUEST when from date format is invalid', async () => {
    // Arrange
    const token = { id: 2, role: RoleType.Manager }
    mockUserRepo.findOne.mockResolvedValue(makeUser({ id: 2 }))

    // Act & Assert
    await expect(
      service.getPendingRequestsByManager(token, 2, { from: 'not-a-date' })
    ).rejects.toThrow(new AppError('Invalid from date format', StatusCodes.BAD_REQUEST))
  })
})

describe('LeaveRequestService.getAllLeaveRequests', () => {
  it('returns all leave requests as admin with no filters', async () => {
    // Arrange
    const token = { id: 1, role: RoleType.Admin }
    mockLeaveRepo.find.mockResolvedValue([makeLeaveRequest()])

    // Act
    const result = await service.getAllLeaveRequests(token, {})

    // Assert
    expect(result.message).toBe('All leave requests')
  })

  it('throws BAD_REQUEST when both employee_id and manager_id filters are provided', async () => {
    // Arrange
    const token = { id: 1, role: RoleType.Admin }

    // Act & Assert
    await expect(
      service.getAllLeaveRequests(token, { employee_id: '4', manager_id: '2' })
    ).rejects.toThrow(
      new AppError('Provide either employee_id or manager_id, not both', StatusCodes.BAD_REQUEST)
    )
  })

  it('returns filtered leave requests by employee_id as admin', async () => {
    // Arrange
    const token = { id: 1, role: RoleType.Admin }
    mockUserRepo.findOne.mockResolvedValue(makeUser({ id: 4 }))
    mockLeaveRepo.find.mockResolvedValue([makeLeaveRequest({ userId: 4 })])

    // Act
    const result = await service.getAllLeaveRequests(token, { employee_id: '4' })

    // Assert
    expect(result.message).toContain('4')
  })

  it('returns filtered leave requests by manager_id as admin', async () => {
    // Arrange
    const token = { id: 1, role: RoleType.Admin }
    mockUserRepo.findOne.mockResolvedValue(makeUser({ id: 2 }))
    mockUserRepo.find.mockResolvedValue([makeUser({ id: 4, managerId: 2 })])
    mockLeaveRepo.find.mockResolvedValue([makeLeaveRequest({ userId: 4 })])

    // Act
    const result = await service.getAllLeaveRequests(token, { manager_id: '2' })

    // Assert
    expect(result.message).toContain('2')
  })

  it('returns team leave requests as manager', async () => {
    // Arrange
    const token = { id: 2, role: RoleType.Manager }
    mockUserRepo.find.mockResolvedValue([makeUser({ id: 4, managerId: 2 })])
    mockLeaveRepo.find.mockResolvedValue([makeLeaveRequest({ userId: 4 })])

    // Act
    const result = await service.getAllLeaveRequests(token, {})

    // Assert
    expect(result.message).toContain('team')
  })

  it('returns empty data when manager has no team', async () => {
    // Arrange
    const token = { id: 2, role: RoleType.Manager }
    mockUserRepo.find.mockResolvedValue([])

    // Act
    const result = await service.getAllLeaveRequests(token, {})

    // Assert
    expect(result.data).toEqual([])
  })

  it('throws BAD_REQUEST when leave_type filter is invalid', async () => {
    // Arrange
    const token = { id: 1, role: RoleType.Admin }

    // Act & Assert
    await expect(
      service.getAllLeaveRequests(token, { leave_type: 'Holiday' })
    ).rejects.toThrow(AppError)
  })

  it('throws BAD_REQUEST when from date filter is invalid', async () => {
    // Arrange
    const token = { id: 1, role: RoleType.Admin }

    // Act & Assert
    await expect(
      service.getAllLeaveRequests(token, { from: 'not-a-date' })
    ).rejects.toThrow(new AppError('Invalid from date format', StatusCodes.BAD_REQUEST))
  })

  it('returns leave requests filtered by leave_type as admin', async () => {
    // Arrange
    const token = { id: 1, role: RoleType.Admin }
    const lr = makeLeaveRequest({ leaveType: LeaveType.Vacation })
    mockLeaveRepo.find.mockResolvedValue([lr])

    // Act
    const result = await service.getAllLeaveRequests(token, { leave_type: 'Vacation' })

    // Assert
    expect(result.message).toBe('All leave requests')
    expect(mockLeaveRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ leaveType: LeaveType.Vacation }) })
    )
  })
})

describe('LeaveRequestService.getTeamUtilisationReport', () => {
  it('throws FORBIDDEN when manager requests another team', async () => {
    // Arrange
    const token = { id: 2, role: RoleType.Manager }

    // Act & Assert
    await expect(service.getTeamUtilisationReport(token, 3)).rejects.toThrow(
      new AppError('You can only view utilisation for your own team', StatusCodes.FORBIDDEN)
    )
  })

  it('returns utilisation report for manager own team', async () => {
    // Arrange
    const token = { id: 2, role: RoleType.Manager }
    mockUserRepo.findOne.mockResolvedValue(makeUser({ id: 2 }))
    mockUserRepo.find.mockResolvedValue([makeUser({ id: 4, managerId: 2, annualLeaveAllowance: 25 })])
    mockLeaveRepo.find.mockResolvedValue([])

    // Act
    const result = await service.getTeamUtilisationReport(token, 2)

    // Assert
    expect(result.message).toContain('2')
    expect(Array.isArray(result.data)).toBe(true)
  })

  it('returns utilisation report as admin for any team', async () => {
    // Arrange
    const token = { id: 1, role: RoleType.Admin }
    mockUserRepo.findOne.mockResolvedValue(makeUser({ id: 2 }))
    mockUserRepo.find.mockResolvedValue([makeUser({ id: 4, managerId: 2, annualLeaveAllowance: 25 })])
    mockLeaveRepo.find.mockResolvedValue([])

    // Act
    const result = await service.getTeamUtilisationReport(token, 2)

    // Assert
    expect(result.message).toContain('2')
  })
})

describe('LeaveRequestService.getStatusBreakdownReport', () => {
  it('returns status breakdown across all leave requests', async () => {
    // Arrange
    mockLeaveRepo.find.mockResolvedValue([
      makeLeaveRequest({ status: LeaveStatus.Approved }),
      makeLeaveRequest({ status: LeaveStatus.Pending }),
    ])

    // Act
    const result = await service.getStatusBreakdownReport({})

    // Assert
    expect(result.message).toBe('Status breakdown report')
    expect(result.data).toMatchObject({ totals: { Approved: 1, Pending: 1 } })
  })

  it('returns empty totals when no users match department filter', async () => {
    // Arrange
    mockUserRepo.find.mockResolvedValue([])

    // Act
    const result = await service.getStatusBreakdownReport({ department_id: '99' })

    // Assert
    expect(result.data).toMatchObject({ totals: { Pending: 0, Approved: 0 } })
  })
})

describe('LeaveRequestService.getBusinessYear', () => {
  it('returns April start for dates on or after April', () => {
    // Arrange
    const may = new Date('2026-05-01')

    // Act
    const { start, end } = service.getBusinessYear(may)

    // Assert
    expect(start.getFullYear()).toBe(2026)
    expect(start.getMonth()).toBe(3)
    expect(end.getFullYear()).toBe(2027)
  })

  it('returns previous April start for dates before April', () => {
    // Arrange
    const january = new Date('2026-01-01')

    // Act
    const { start } = service.getBusinessYear(january)

    // Assert
    expect(start.getFullYear()).toBe(2025)
    expect(start.getMonth()).toBe(3)
  })
})

describe('LeaveRequestService.canAccessEmployee', () => {
  it('Admin can access any employee', async () => {
    // Arrange
    const token = { id: 1, role: RoleType.Admin }

    // Act
    const result = await service.canAccessEmployee(token, 99)

    // Assert
    expect(result).toBe(true)
  })

  it('Employee can only access their own record', async () => {
    // Arrange
    const token = { id: 4, role: RoleType.Employee }

    // Act & Assert
    expect(await service.canAccessEmployee(token, 4)).toBe(true)
    expect(await service.canAccessEmployee(token, 5)).toBe(false)
  })

  it('Manager can access their own record directly', async () => {
    // Arrange
    const token = { id: 2, role: RoleType.Manager }

    // Act
    const result = await service.canAccessEmployee(token, 2)

    // Assert
    expect(result).toBe(true)
  })

  it('Manager can access a direct report via DB lookup', async () => {
    // Arrange
    const token = { id: 2, role: RoleType.Manager }
    mockUserRepo.findOne.mockResolvedValue(makeUser({ id: 4, managerId: 2 }))

    // Act
    const result = await service.canAccessEmployee(token, 4)

    // Assert
    expect(result).toBe(true)
  })

  it('Manager cannot access employee outside their team', async () => {
    // Arrange
    const token = { id: 2, role: RoleType.Manager }
    mockUserRepo.findOne.mockResolvedValue(null)

    // Act
    const result = await service.canAccessEmployee(token, 6)

    // Assert
    expect(result).toBe(false)
  })
})
