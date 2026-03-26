import { RoleType } from '@enums'

export interface Role {
  readonly roleId: number
  readonly name: RoleType
}
