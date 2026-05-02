import { Department, JobRole, LeaveRequest, User } from '@entities'
import { Router } from 'express'
import 'reflect-metadata'
import { DepartmentController } from './controllers/DepartmentController.ts'
import { JobRoleController } from './controllers/JobRoleController.ts'
import { LeaveRequestController } from './controllers/LeaveRequestController.ts'
import { LoginController } from './controllers/LoginController.ts'
import { UserController } from './controllers/UserController.ts'
import { AppDataSource } from './data_source.ts'
import { DepartmentRouter } from './routes/DepartmentRouter.ts'
import { JobRoleRouter } from './routes/JobRoleRouter.ts'
import { LeaveRouter } from './routes/LeaveRouter.ts'
import { LoginRouter } from './routes/LoginRouter.ts'
import { UserRouter } from './routes/UserRouter.ts'
import { Server } from './Server.ts'
import type { IRouter } from './types/IRouter.ts'

const DEFAULT_PORT = 3000
const port = process.env.PORT ?? DEFAULT_PORT

const routers: Array<IRouter> = [
  new LoginRouter(
    Router(),
    new LoginController(AppDataSource.getRepository(User))
  ),
  new DepartmentRouter(
    Router(),
    new DepartmentController(AppDataSource.getRepository(Department))
  ),
  new JobRoleRouter(
    Router(),
    new JobRoleController(AppDataSource.getRepository(JobRole))
  ),
  new UserRouter(
    Router(),
    new UserController(AppDataSource.getRepository(User))
  ),
  new LeaveRouter(
    Router(),
    new LeaveRequestController(
      AppDataSource.getRepository(User),
      AppDataSource.getRepository(LeaveRequest)
    )
  ),
]

const server = new Server(port, routers, AppDataSource)
server.start()
