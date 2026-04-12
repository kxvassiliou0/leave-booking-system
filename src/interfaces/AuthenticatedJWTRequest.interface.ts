import type { RoleType } from '@enums'
import type { Request } from 'express'

export interface AuthenticatedJWTRequest extends Request {
  signedInUser?: {
    token?: {
      email?: string
      role?: RoleType
    }
  }
}
