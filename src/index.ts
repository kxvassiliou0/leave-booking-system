import 'reflect-metadata'
import { Router } from 'express'
import { AppDataSource } from './data_source.ts'
import { JobRoleController } from './controllers/JobRoleController.ts'
import { UserController } from './controllers/UserController.ts'
import { LeaveRequestController } from './controllers/LeaveRequestController.ts'
import { JobRoleRouter } from './routes/JobRoleRouter.ts'
import { UserRouter } from './routes/UserRouter.ts'
import { LeaveRouter } from './routes/LeaveRouter.ts'
import { JobRole, User, LeaveRequest } from '@entities'
import { Server } from './Server.ts'

const DEFAULT_PORT = 3000
const port = process.env.PORT ?? DEFAULT_PORT

const jobRoleRouter = new JobRoleRouter(
  Router(),
  new JobRoleController(AppDataSource.getRepository(JobRole))
)

const userRouter = new UserRouter(Router(), new UserController(AppDataSource.getRepository(User)))

const leaveRouter = new LeaveRouter(
  Router(),
  new LeaveRequestController(
    AppDataSource.getRepository(User),
    AppDataSource.getRepository(LeaveRequest)
  )
)

const server = new Server(port, jobRoleRouter, userRouter, leaveRouter, AppDataSource)
server.start()
