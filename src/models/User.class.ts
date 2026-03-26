import { Role } from '.'
import type { User as UserContract } from '@interfaces'

export class User implements UserContract {
  public annualLeaveBalance: number = 25

  constructor(
    public readonly userId: number,
    public readonly firstname: string,
    public readonly surname: string,
    public readonly email: string,
    public readonly password: string,
    public readonly salt: string,
    public readonly role: Role
  ) {}

  toString(): string {
    return `User [userId=${this.userId}, name=${this.firstname} ${this.surname}, email=${this.email}, role=${this.role.name}, annualLeaveBalance=${this.annualLeaveBalance}]`
  }
}
