import express, { type Request, type Response } from 'express'
import { StatusCodes } from 'http-status-codes'
import morgan, { type StreamOptions } from 'morgan'
import { type DataSource } from 'typeorm'
import { Logger } from './helpers/Logger.ts'
import { ResponseHandler } from './helpers/ResponseHandler.ts'
import { type JobRoleRouter } from './routes/JobRoleRouter.ts'
import { type UserRouter } from './routes/UserRouter.ts'
import { type LeaveRouter } from './routes/LeaveRouter.ts'

export class Server {
  private readonly app: express.Application

  constructor(
    private readonly port: string | number,
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
    this.app.use('/api/job-roles', this.jobRoleRouter.getRouter())
    this.app.use('/api/users', this.userRouter.getRouter())
    this.app.use('/api/leave-requests', this.leaveRouter.getRouter())
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
