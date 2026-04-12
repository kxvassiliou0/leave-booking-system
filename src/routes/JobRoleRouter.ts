import { RoleType } from '@enums'
import { Router } from 'express'
import { JobRoleController } from '../controllers/JobRoleController.ts'
import { requireRole } from '../middleware/requireRole.ts'

export class JobRoleRouter {
  constructor(
    private readonly router: Router,
    private readonly jobRoleController: JobRoleController
  ) {
    this.addRoutes()
  }

  public getRouter(): Router {
    return this.router
  }

  private addRoutes(): void {
    // All authenticated users can view job roles
    this.router.get('/', this.jobRoleController.getAll)
    this.router.get('/:id', this.jobRoleController.getById)

    // Only admins can create, update, or delete job roles
    this.router.post(
      '/',
      requireRole(RoleType.Admin),
      this.jobRoleController.create
    )
    this.router.patch(
      '/:id',
      requireRole(RoleType.Admin),
      this.jobRoleController.update
    )
    this.router.delete(
      '/:id',
      requireRole(RoleType.Admin),
      this.jobRoleController.delete
    )
  }
}
