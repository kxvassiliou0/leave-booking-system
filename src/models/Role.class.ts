import { RoleType } from '@enums'
import type { Role as RoleContract } from '@interfaces'

export class Role implements RoleContract {
  constructor(
    public readonly roleId: number,
    public readonly name: RoleType
  ) {}

  toString(): string {
    return `Role [roleId=${this.roleId}, name=${this.name}]`
  }
}
