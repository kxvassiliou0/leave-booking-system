import { LeaveStatus, LeaveType } from '@enums'
import type { LeaveRequest as LeaveRequestContract } from '@interfaces'

export class LeaveRequest implements LeaveRequestContract {
  constructor(
    public readonly leaveRequestId: number,
    public readonly userId: number,
    public readonly leaveType: LeaveType,
    public readonly startDate: Date,
    public readonly endDate: Date,
    public status: LeaveStatus,
    public readonly reason: string
  ) {}

  toString(): string {
    return `LeaveRequest [leaveRequestId=${this.leaveRequestId}, userId=${this.userId}, leaveType=${this.leaveType}, startDate=${this.startDate.toISOString()}, endDate=${this.endDate.toISOString()}, status=${this.status}, reason=${this.reason}]`
  }
}
