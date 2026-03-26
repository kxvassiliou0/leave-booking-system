import { LeaveStatus, LeaveType } from '@enums'

export interface LeaveRequest {
  readonly leaveRequestId: number
  readonly userId: number
  readonly leaveType: LeaveType
  readonly startDate: Date
  readonly endDate: Date
  status: LeaveStatus
  readonly reason: string
}
