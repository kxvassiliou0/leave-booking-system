import type { Department as DepartmentContract } from '@interfaces'

export class Department implements DepartmentContract {
  constructor(
    public readonly departmentId: number,
    public readonly name: string
  ) {}

  toString(): string {
    return `Department [departmentId=${this.departmentId}, name=${this.name}]`
  }
}
