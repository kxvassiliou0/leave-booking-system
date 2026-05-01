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
    const body = {
      userId: 1,
      startDate: '2026-05-01',
      endDate: '2026-05-05',
      leaveType: 'Vacation',
    }

    const response = await request(app).post(BASE_URL).send(body)

    expect(mockLeaveController.createLeaveRequest).toHaveBeenCalled()
    expect(response.status).toBe(StatusCodes.CREATED)
  })

  it('DELETE /leave-requests calls deleteLeaveRequest', async () => {
    const response = await request(app).delete(BASE_URL).send({ userId: 1, leaveRequestId: 10 })

    expect(mockLeaveController.deleteLeaveRequest).toHaveBeenCalled()
    expect(response.status).toBe(StatusCodes.OK)
  })

  it('PATCH /leave-requests/approve calls approveLeaveRequest', async () => {
    const response = await request(app)
      .patch(`${BASE_URL}/approve`)
      .send({ leaveRequestId: 10, reviewerId: 2 })

    expect(mockLeaveController.approveLeaveRequest).toHaveBeenCalled()
    expect(response.status).toBe(StatusCodes.OK)
  })

  it('PATCH /leave-requests/reject calls rejectLeaveRequest', async () => {
    const response = await request(app)
      .patch(`${BASE_URL}/reject`)
      .send({ leaveRequestId: 10, reviewerId: 2 })

    expect(mockLeaveController.rejectLeaveRequest).toHaveBeenCalled()
    expect(response.status).toBe(StatusCodes.OK)
  })

  it('GET /leave-requests/status/:employee_id calls getLeaveRequestsByEmployee', async () => {
    const employeeId = '1'

    const response = await request(app).get(`${BASE_URL}/status/${employeeId}`)

    const reqArg = (mockLeaveController.getLeaveRequestsByEmployee as jest.Mock).mock.calls[0][0]
    expect(reqArg.params.employee_id).toBe(employeeId)
    expect(mockLeaveController.getLeaveRequestsByEmployee).toHaveBeenCalled()
    expect(response.status).toBe(StatusCodes.OK)
  })

  it('GET /leave-requests/remaining/:employee_id calls getRemainingLeave', async () => {
    const employeeId = '1'

    const response = await request(app).get(`${BASE_URL}/remaining/${employeeId}`)

    const reqArg = (mockLeaveController.getRemainingLeave as jest.Mock).mock.calls[0][0]
    expect(reqArg.params.employee_id).toBe(employeeId)
    expect(mockLeaveController.getRemainingLeave).toHaveBeenCalled()
    expect(response.status).toBe(StatusCodes.OK)
  })

  it('GET /leave-requests calls getAllLeaveRequests', async () => {
    const response = await request(app).get(BASE_URL)

    expect(mockLeaveController.getAllLeaveRequests).toHaveBeenCalled()
    expect(response.status).toBe(StatusCodes.OK)
  })

  it('GET /leave-requests/pending/manager/:manager_id calls getPendingRequestsByManager', async () => {
    const managerId = '2'

    const response = await request(app).get(`${BASE_URL}/pending/manager/${managerId}`)

    const reqArg = (mockLeaveController.getPendingRequestsByManager as jest.Mock).mock.calls[0][0]
    expect(reqArg.params.manager_id).toBe(managerId)
    expect(mockLeaveController.getPendingRequestsByManager).toHaveBeenCalled()
    expect(response.status).toBe(StatusCodes.OK)
  })

  it('GET /leave-requests/reports/team-utilisation/:manager_id calls getTeamUtilisationReport', async () => {
    const managerId = '3'

    const response = await request(app).get(`${BASE_URL}/reports/team-utilisation/${managerId}`)

    const reqArg = (mockLeaveController.getTeamUtilisationReport as jest.Mock).mock.calls[0][0]
    expect(reqArg.params.manager_id).toBe(managerId)
    expect(mockLeaveController.getTeamUtilisationReport).toHaveBeenCalled()
    expect(response.status).toBe(StatusCodes.OK)
  })

  it('GET /leave-requests/reports/status-breakdown calls getStatusBreakdownReport', async () => {
    const response = await request(app).get(`${BASE_URL}/reports/status-breakdown`)

    expect(mockLeaveController.getStatusBreakdownReport).toHaveBeenCalled()
    expect(response.status).toBe(StatusCodes.OK)
  })
})
