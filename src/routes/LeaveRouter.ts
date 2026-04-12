import { Router } from 'express'
import { LeaveRequestController } from '../controllers/LeaveRequestController.ts'

export class LeaveRouter {
  constructor(
    private readonly router: Router,
    private readonly leaveController: LeaveRequestController
  ) {
    this.addRoutes()
  }

  public getRouter(): Router {
    return this.router
  }

  private addRoutes(): void {
    this.router.get('/', this.leaveController.getAllLeaveRequests)
    this.router.post('/', this.leaveController.createLeaveRequest)
    this.router.delete('/', this.leaveController.deleteLeaveRequest)
    this.router.patch('/approve', this.leaveController.approveLeaveRequest)
    this.router.patch('/reject', this.leaveController.rejectLeaveRequest)
    this.router.get('/pending/manager/:manager_id', this.leaveController.getPendingRequestsByManager)
    this.router.get('/status/:employee_id', this.leaveController.getLeaveRequestsByEmployee)
    this.router.get('/remaining/:employee_id', this.leaveController.getRemainingLeave)
  }
}
