import type { UserManagement as UserManagementContract } from '@interfaces'

export class UserManagement implements UserManagementContract {
  constructor(
    public readonly id: number,
    public readonly userId: number,
    public readonly managerId: number,
    public readonly startDate: Date,
    public readonly endDate: Date
  ) {}

  toString(): string {
    return `UserManagement [id=${this.id}, userId=${this.userId}, managerId=${this.managerId}, startDate=${this.startDate.toISOString()}, endDate=${this.endDate.toISOString()}]`
  }
}
