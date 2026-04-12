import type { Request, Response } from 'express'
import { StatusCodes } from 'http-status-codes'
import jwt from 'jsonwebtoken'
import type { Repository } from 'typeorm'
import { UserDTOToken } from '../dto/UserDTOToken.ts'
import { User } from '../entities/User.entity.ts'
import { PasswordHandler } from '../helpers/PasswordHandler.ts'
import { ResponseHandler } from '../helpers/ResponseHandler.ts'

export class LoginController {
  public static readonly ERROR_USER_NOT_FOUND = 'User not found'
  public static readonly ERROR_PASSWORD_INCORRECT = 'Incorrect password'

  constructor(private readonly userRepository: Repository<User>) {}

  public login = async (req: Request, res: Response): Promise<void> => {
    try {
      const { email, password } = req.body

      if (!email || !password) {
        ResponseHandler.sendErrorResponse(
          res,
          StatusCodes.BAD_REQUEST,
          'Email and password are required'
        )
        return
      }

      const user = await this.userRepository
        .createQueryBuilder('user')
        .addSelect(['user.password', 'user.salt'])
        .where('user.email = :email', { email })
        .getOne()

      if (!user) {
        throw new Error(LoginController.ERROR_USER_NOT_FOUND)
      }

      if (!PasswordHandler.verifyPassword(password, user.password, user.salt)) {
        throw new Error(LoginController.ERROR_PASSWORD_INCORRECT)
      }

      const token = new UserDTOToken(user.email, user.role)

      res.status(StatusCodes.ACCEPTED).send(
        jwt.sign({ token }, process.env.JWT_SECRET_KEY as string, {
          expiresIn: '3h',
        })
      )
    } catch (error: any) {
      ResponseHandler.sendErrorResponse(
        res,
        StatusCodes.BAD_REQUEST,
        error.message
      )
    }
  }
}
