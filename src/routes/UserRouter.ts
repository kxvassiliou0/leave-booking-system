import { RoleType } from '@enums'
import { Router } from 'express'
import { UserController } from '../controllers/UserController.ts'
import { requireRole } from '../middleware/requireRole.ts'

export class UserRouter {
  constructor(
    private readonly router: Router,
    private readonly userController: UserController
  ) {
    this.addRoutes()
  }

  public getRouter(): Router {
    return this.router
  }

  private addRoutes(): void {
    this.router.get(
      '/',
      requireRole(RoleType.Admin),
      this.userController.getAll
    )
    this.router.get(
      '/:id',
      requireRole(RoleType.Admin),
      this.userController.getById
    )
    this.router.post(
      '/',
      requireRole(RoleType.Admin),
      this.userController.create
    )
    this.router.patch(
      '/:id',
      requireRole(RoleType.Admin),
      this.userController.update
    )
    this.router.delete(
      '/:id',
      requireRole(RoleType.Admin),
      this.userController.delete
    )
  }
}
