import request from 'supertest'
import express, { Router } from 'express'
import type { AuthenticatedJWTRequest } from '../interfaces/AuthenticatedJWTRequest.interface'
import { RoleType } from '../enums/index'
import { LeaveRouter } from './LeaveRouter'
import { LeaveRequestController } from '../controllers/LeaveRequestController'
import { StatusCodes } from 'http-status-codes'

const mockLeaveController = {
  getAllLeaveRequests: jest.fn((_req, res) => res.status(StatusCodes.OK).json([])),
  createLeaveRequest: jest.fn((req, res) => res.status(StatusCodes.CREATED).json(req.body)),
  deleteLeaveRequest: jest.fn((_req, res) =>
    res.status(StatusCodes.OK).json({ message: 'deleted' })
  ),
  approveLeaveRequest: jest.fn((req, res) => res.status(StatusCodes.OK).json(req.body)),
  rejectLeaveRequest: jest.fn((req, res) => res.status(StatusCodes.OK).json(req.body)),
  getPendingRequestsByManager: jest.fn((req, res) =>
    res.status(StatusCodes.OK).json({ managerId: req.params.manager_id })
  ),
  getLeaveRequestsByEmployee: jest.fn((req, res) =>
    res.status(StatusCodes.OK).json({ employeeId: req.params.employee_id })
  ),
  getRemainingLeave: jest.fn((req, res) =>
    res.status(StatusCodes.OK).json({ employeeId: req.params.employee_id })
  ),
  getTeamUtilisationReport: jest.fn((req, res) =>
    res.status(StatusCodes.OK).json({ managerId: req.params.manager_id })
  ),
  getStatusBreakdownReport: jest.fn((_req, res) =>
    res.status(StatusCodes.OK).json({ scope: 'company-wide' })
  ),
} as unknown as LeaveRequestController

const router = Router()
jest.spyOn(router, 'get')
jest.spyOn(router, 'post')
jest.spyOn(router, 'patch')
jest.spyOn(router, 'delete')

const app = express()
app.use(express.json())
app.use((req, _res, next) => {
  ;(req as AuthenticatedJWTRequest).signedInUser = { token: { email: 'admin@test.com', role: RoleType.Admin } }
  next()
})

const leaveRouter = new LeaveRouter(router, mockLeaveController)
app.use('/leave-requests', leaveRouter.getRouter())

const BASE_URL = '/leave-requests'

describe('LeaveRouter', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('POST /leave-requests calls createLeaveRequest', async () => {
    // Arrange
    const body = {
      userId: 1,
      startDate: '2026-05-01',
      endDate: '2026-05-05',
      leaveType: 'Vacation',
    }

    // Act
    const response = await request(app).post(BASE_URL).send(body)

    // Assert
    expect(mockLeaveController.createLeaveRequest).toHaveBeenCalled()
    expect(response.status).toBe(StatusCodes.CREATED)
  })

  it('DELETE /leave-requests calls deleteLeaveRequest', async () => {
    // Arrange
    const body = { userId: 1, leaveRequestId: 10 }

    // Act
    const response = await request(app).delete(BASE_URL).send(body)

    // Assert
    expect(mockLeaveController.deleteLeaveRequest).toHaveBeenCalled()
    expect(response.status).toBe(StatusCodes.OK)
  })

  it('PATCH /leave-requests/approve calls approveLeaveRequest', async () => {
    // Arrange
    const body = { leaveRequestId: 10, reviewerId: 2 }

    // Act
    const response = await request(app).patch(`${BASE_URL}/approve`).send(body)

    // Assert
    expect(mockLeaveController.approveLeaveRequest).toHaveBeenCalled()
    expect(response.status).toBe(StatusCodes.OK)
  })

  it('PATCH /leave-requests/reject calls rejectLeaveRequest', async () => {
    // Arrange
    const body = { leaveRequestId: 10, reviewerId: 2 }

    // Act
    const response = await request(app).patch(`${BASE_URL}/reject`).send(body)

    // Assert
    expect(mockLeaveController.rejectLeaveRequest).toHaveBeenCalled()
    expect(response.status).toBe(StatusCodes.OK)
  })

  it('GET /leave-requests/status/:employee_id calls getLeaveRequestsByEmployee', async () => {
    // Arrange
    const employeeId = '1'

    // Act
    const response = await request(app).get(`${BASE_URL}/status/${employeeId}`)

    // Assert
    const reqArg = (mockLeaveController.getLeaveRequestsByEmployee as jest.Mock).mock.calls[0][0]
    expect(reqArg.params.employee_id).toBe(employeeId)
    expect(mockLeaveController.getLeaveRequestsByEmployee).toHaveBeenCalled()
    expect(response.status).toBe(StatusCodes.OK)
  })

  it('GET /leave-requests/remaining/:employee_id calls getRemainingLeave', async () => {
    // Arrange
    const employeeId = '1'

    // Act
    const response = await request(app).get(`${BASE_URL}/remaining/${employeeId}`)

    // Assert
    const reqArg = (mockLeaveController.getRemainingLeave as jest.Mock).mock.calls[0][0]
    expect(reqArg.params.employee_id).toBe(employeeId)
    expect(mockLeaveController.getRemainingLeave).toHaveBeenCalled()
    expect(response.status).toBe(StatusCodes.OK)
  })

  it('GET /leave-requests calls getAllLeaveRequests', async () => {
    // Arrange — no additional setup needed

    // Act
    const response = await request(app).get(BASE_URL)

    // Assert
    expect(mockLeaveController.getAllLeaveRequests).toHaveBeenCalled()
    expect(response.status).toBe(StatusCodes.OK)
  })

  it('GET /leave-requests/pending/manager/:manager_id calls getPendingRequestsByManager', async () => {
    // Arrange
    const managerId = '2'

    // Act
    const response = await request(app).get(`${BASE_URL}/pending/manager/${managerId}`)

    // Assert
    const reqArg = (mockLeaveController.getPendingRequestsByManager as jest.Mock).mock.calls[0][0]
    expect(reqArg.params.manager_id).toBe(managerId)
    expect(mockLeaveController.getPendingRequestsByManager).toHaveBeenCalled()
    expect(response.status).toBe(StatusCodes.OK)
  })

  it('GET /leave-requests/reports/team-utilisation/:manager_id calls getTeamUtilisationReport', async () => {
    // Arrange
    const managerId = '3'

    // Act
    const response = await request(app).get(`${BASE_URL}/reports/team-utilisation/${managerId}`)

    // Assert
    const reqArg = (mockLeaveController.getTeamUtilisationReport as jest.Mock).mock.calls[0][0]
    expect(reqArg.params.manager_id).toBe(managerId)
    expect(mockLeaveController.getTeamUtilisationReport).toHaveBeenCalled()
    expect(response.status).toBe(StatusCodes.OK)
  })

  it('GET /leave-requests/reports/status-breakdown calls getStatusBreakdownReport', async () => {
    // Arrange — no additional setup needed

    // Act
    const response = await request(app).get(`${BASE_URL}/reports/status-breakdown`)

    // Assert
    expect(mockLeaveController.getStatusBreakdownReport).toHaveBeenCalled()
    expect(response.status).toBe(StatusCodes.OK)
  })
})
