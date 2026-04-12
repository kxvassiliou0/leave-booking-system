import { RoleType } from '@enums'
import { Router } from 'express'
import { LeaveRequestController } from '../controllers/LeaveRequestController.ts'
import { requireRole } from '../middleware/requireRole.ts'

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
    // Admin can view all leave requests, managers can view their team's
    this.router.get(
      '/',
      requireRole(RoleType.Admin, RoleType.Manager),
      this.leaveController.getAllLeaveRequests
    )

    // All roles can submit leave requests
    this.router.post(
      '/',
      requireRole(RoleType.Employee, RoleType.Manager, RoleType.Admin),
      this.leaveController.createLeaveRequest
    )

    // All roles can cancel leave requests
    this.router.delete(
      '/',
      requireRole(RoleType.Employee, RoleType.Manager, RoleType.Admin),
      this.leaveController.deleteLeaveRequest
    )

    // Managers and admins can approve or reject leave requests
    this.router.patch(
      '/approve',
      requireRole(RoleType.Manager, RoleType.Admin),
      this.leaveController.approveLeaveRequest
    )
    this.router.patch(
      '/reject',
      requireRole(RoleType.Manager, RoleType.Admin),
      this.leaveController.rejectLeaveRequest
    )

    // Managers and admins can view pending requests for a team
    this.router.get(
      '/pending/manager/:manager_id',
      requireRole(RoleType.Manager, RoleType.Admin),
      this.leaveController.getPendingRequestsByManager
    )

    // All authenticated users can view leave status and remaining leave
    this.router.get(
      '/status/:employee_id',
      this.leaveController.getLeaveRequestsByEmployee
    )
    this.router.get(
      '/remaining/:employee_id',
      this.leaveController.getRemainingLeave
    )
  }
}
