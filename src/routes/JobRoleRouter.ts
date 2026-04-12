import { Router } from 'express'
import { JobRoleController } from '../controllers/JobRoleController.ts'

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
    this.router.get('/', this.jobRoleController.getAll)
    this.router.get('/:id', this.jobRoleController.getById)
    this.router.post('/', this.jobRoleController.create)
    this.router.patch('/:id', this.jobRoleController.update)
    this.router.delete('/:id', this.jobRoleController.delete)
  }
}
