import { RoleType } from '@enums'
import type { NextFunction, Request, Response } from 'express'
import { StatusCodes } from 'http-status-codes'
import { ResponseHandler } from '../helpers/ResponseHandler.ts'

export function requireRole(...roles: RoleType[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const signedInUser = (req as any).signedInUser

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
