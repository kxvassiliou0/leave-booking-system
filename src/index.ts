import { JobRole, LeaveRequest, User } from '@entities'
import { Router } from 'express'
import 'reflect-metadata'
import { JobRoleController } from './controllers/JobRoleController.ts'
import { LeaveRequestController } from './controllers/LeaveRequestController.ts'
import { LoginController } from './controllers/LoginController.ts'
import { UserController } from './controllers/UserController.ts'
import { AppDataSource } from './data_source.ts'
import { JobRoleRouter } from './routes/JobRoleRouter.ts'
import { LeaveRouter } from './routes/LeaveRouter.ts'
import { LoginRouter } from './routes/LoginRouter.ts'
import { UserRouter } from './routes/UserRouter.ts'
import { Server } from './Server.ts'

const DEFAULT_PORT = 3000
const port = process.env.PORT ?? DEFAULT_PORT

const loginRouter = new LoginRouter(
  Router(),
  new LoginController(AppDataSource.getRepository(User))
)

const jobRoleRouter = new JobRoleRouter(
  Router(),
  new JobRoleController(AppDataSource.getRepository(JobRole))
)

const userRouter = new UserRouter(
  Router(),
  new UserController(AppDataSource.getRepository(User))
)

const leaveRouter = new LeaveRouter(
  Router(),
  new LeaveRequestController(
    AppDataSource.getRepository(User),
    AppDataSource.getRepository(LeaveRequest)
  )
)

const server = new Server(
  port,
  loginRouter,
  jobRoleRouter,
  userRouter,
  leaveRouter,
  AppDataSource
)
server.start()
