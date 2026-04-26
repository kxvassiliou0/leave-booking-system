import { RoleType } from '@enums'
import type { NextFunction, Response } from 'express'
import type { AuthenticatedJWTRequest as Request } from '../interfaces/AuthenticatedJWTRequest.interface.ts'
import { StatusCodes } from 'http-status-codes'
import { ResponseHandler } from '../helpers/ResponseHandler.ts'

export function requireRole(...roles: RoleType[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const signedInUser = req.signedInUser

    if (!signedInUser?.token?.role) {
      ResponseHandler.sendErrorResponse(
        res,
        StatusCodes.FORBIDDEN,
        'Access denied'
      )
      return
    }

    if (!roles.includes(signedInUser.token.role as RoleType)) {
      ResponseHandler.sendErrorResponse(
        res,
        StatusCodes.FORBIDDEN,
        `Access denied - requires one of: ${roles.join(', ')}`
      )
      return
    }

    next()
  }
}
