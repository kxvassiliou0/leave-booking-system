import express, {
  type NextFunction,
  type Request,
  type Response,
} from 'express'
import { StatusCodes } from 'http-status-codes'
import jwt from 'jsonwebtoken'
import morgan, { type StreamOptions } from 'morgan'
import { type DataSource } from 'typeorm'
import { Logger } from './helpers/Logger.ts'
import { ResponseHandler } from './helpers/ResponseHandler.ts'
import { type JobRoleRouter } from './routes/JobRoleRouter.ts'
import { type LeaveRouter } from './routes/LeaveRouter.ts'
import { type LoginRouter } from './routes/LoginRouter.ts'
import { type UserRouter } from './routes/UserRouter.ts'

export class Server {
  public static readonly ERROR_TOKEN_IS_INVALID =
    'Not authorised - Token is invalid'
  public static readonly ERROR_TOKEN_NOT_FOUND =
    'Not authorised - Token not found'
  public static readonly ERROR_TOKEN_SECRET_NOT_DEFINED =
    'JWT_SECRET_KEY is not defined'

  private readonly app: express.Application

  constructor(
    private readonly port: string | number,
    private readonly loginRouter: LoginRouter,
    private readonly jobRoleRouter: JobRoleRouter,
    private readonly userRouter: UserRouter,
    private readonly leaveRouter: LeaveRouter,
    private readonly appDataSource: DataSource
  ) {
    this.app = express()

    this.initialiseMiddlewares()
    this.initialiseRoutes()
    this.initialiseErrorHandling()
  }

  private initialiseMiddlewares(): void {
    const morganStream: StreamOptions = {
      write: (message: string): void => {
        Logger.info(message.trim())
      },
    }

    this.app.use(express.json())
    this.app.use(morgan('combined', { stream: morganStream }))
  }

  private initialiseRoutes(): void {
    this.app.use('/api/login', this.loginRouter.getRouter())
    this.app.use(
      '/api/job-roles',
      this.authenticateToken,
      this.jobRoleRouter.getRouter()
    )
    this.app.use(
      '/api/users',
      this.authenticateToken,
      this.userRouter.getRouter()
    )
    this.app.use(
      '/api/leave-requests',
      this.authenticateToken,
      this.leaveRouter.getRouter()
    )
  }

  private initialiseErrorHandling(): void {
    this.app.use((req: Request, res: Response) => {
      const requestedUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`
      ResponseHandler.sendErrorResponse(
        res,
        StatusCodes.NOT_FOUND,
        `Route ${requestedUrl} not found`
      )
    })
  }

  private authenticateToken = (
    req: Request,
    res: Response,
    next: NextFunction
  ): void => {
    const authHeader = req.headers.authorization

    if (authHeader) {
      const tokenReceived = authHeader.split(' ')[1]

      if (!process.env.JWT_SECRET_KEY) {
        Logger.error(Server.ERROR_TOKEN_SECRET_NOT_DEFINED)
        ResponseHandler.sendErrorResponse(
          res,
          StatusCodes.BAD_REQUEST,
          Server.ERROR_TOKEN_IS_INVALID
        )
        return
      }

      jwt.verify(tokenReceived, process.env.JWT_SECRET_KEY, (err, payload) => {
        if (err) {
          Logger.error(Server.ERROR_TOKEN_IS_INVALID)
          ResponseHandler.sendErrorResponse(
            res,
            StatusCodes.UNAUTHORIZED,
            Server.ERROR_TOKEN_IS_INVALID
          )
          return
        }

        ;(req as any).signedInUser = payload
        next()
      })
    } else {
      Logger.error(Server.ERROR_TOKEN_NOT_FOUND)
      ResponseHandler.sendErrorResponse(
        res,
        StatusCodes.UNAUTHORIZED,
        Server.ERROR_TOKEN_NOT_FOUND
      )
    }
  }

  public async start(): Promise<void> {
    await this.initialiseDataSource()
    this.app.listen(this.port, () => {
      Logger.info(`Server running on http://localhost:${this.port}`)
    })
  }

  private async initialiseDataSource(): Promise<void> {
    try {
      await this.appDataSource.initialize()
      Logger.info('Data Source initialised')
    } catch (error) {
      Logger.error('Error during initialisation', { error })
      throw error
    }
  }
}
