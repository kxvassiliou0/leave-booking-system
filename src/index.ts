import 'reflect-metadata'
import { Router } from 'express'
import { AppDataSource } from './data_source.ts'
import { RoleController } from './controllers/RoleController'
import { UserController } from './controllers/UserController.ts'
import { LeaveRequestController } from './controllers/LeaveRequestController.ts'
import { RoleRouter } from './routes/RoleRouter'
import { UserRouter } from './routes/UserRouter.ts'
import { LeaveRouter } from './routes/LeaveRouter.ts'
import { Role, User, LeaveRequest } from '@entities'
import { Server } from './Server.ts'

const DEFAULT_PORT = 3000
const port = process.env.PORT ?? DEFAULT_PORT

const roleRouter = new RoleRouter(Router(), new RoleController(AppDataSource.getRepository(Role)))

const userRouter = new UserRouter(Router(), new UserController(AppDataSource.getRepository(User)))

const leaveRouter = new LeaveRouter(
  Router(),
  new LeaveRequestController(
    AppDataSource.getRepository(User),
    AppDataSource.getRepository(LeaveRequest)
  )
)

const server = new Server(port, roleRouter, userRouter, leaveRouter, AppDataSource)
server.start()
