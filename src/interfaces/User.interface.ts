import type { Department, JobRole, Role } from '.'

export interface User {
  readonly userId: number
  readonly firstname: string
  readonly surname: string
  readonly email: string
  readonly password: string
  readonly salt: string
  readonly role: Role
  readonly jobRole: JobRole
  readonly department: Department
  annualLeaveBalance: number
}
