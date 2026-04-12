import type { JobRole as JobRoleContract } from '@interfaces'

export class JobRole implements JobRoleContract {
  constructor(
    public readonly jobRoleId: number,
    public readonly name: string
  ) {}

  toString(): string {
    return `JobRole [jobRoleId=${this.jobRoleId}, name=${this.name}]`
  }
}
