import { Router } from 'express'
import { UserController } from '../controllers/UserController.ts'

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
    this.router.get('/', this.userController.getAll)
    this.router.get('/:id', this.userController.getById)
    this.router.post('/', this.userController.create)
    this.router.patch('/:id', this.userController.update)
    this.router.delete('/:id', this.userController.delete)
  }
}
