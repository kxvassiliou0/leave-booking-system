import 'reflect-metadata'
import { AppDataSource } from './data_source.ts'
import { Department } from './entities/Department.entity.ts'
import { User } from './entities/User.entity.ts'
import { LeaveRequest } from './entities/LeaveRequest.entity.ts'
import { RoleType, LeaveType, LeaveStatus } from '@enums'
import type { User as UserContract, LeaveRequest as LeaveRequestContract } from '@interfaces'

type SeedUserInput = Pick<UserContract, 'firstname' | 'surname' | 'email' | 'password'> & {
  role: RoleType
  annualLeaveAllowance: number
  departmentId: number
  managerId: number | null
}

type SeedLeaveInput = Pick<
  LeaveRequestContract,
  'leaveType' | 'startDate' | 'endDate' | 'status' | 'reason'
> & {
  userId: number
  daysRequested: number
  reviewedById: number | null
}

async function seed() {
  await AppDataSource.initialize()

  const departmentRepo = AppDataSource.getRepository(Department)
  const userRepo = AppDataSource.getRepository(User)
  const leaveRepo = AppDataSource.getRepository(LeaveRequest)

  await AppDataSource.query('SET FOREIGN_KEY_CHECKS = 0')
  await leaveRepo.clear()
  await userRepo.clear()
  await departmentRepo.clear()
  await AppDataSource.query('SET FOREIGN_KEY_CHECKS = 1')

  const [engineering, hr, finance, marketing] = await departmentRepo.save([
    departmentRepo.create({ name: 'Engineering' }),
    departmentRepo.create({ name: 'Human Resources' }),
    departmentRepo.create({ name: 'Finance' }),
    departmentRepo.create({ name: 'Marketing' }),
  ])

  const defaultPassword = 'Password123!'

  const createUser = (data: SeedUserInput) =>
    userRepo.create({
      firstName: data.firstname,
      lastName: data.surname,
      email: data.email,
      password: data.password,
      role: data.role,
      annualLeaveAllowance: data.annualLeaveAllowance,
      departmentId: data.departmentId,
      managerId: data.managerId,
    })

  await userRepo.save(
    createUser({
      firstname: 'Alice',
      surname: 'Thompson',
      email: 'alice.thompson@company.com',
      password: defaultPassword,
      role: RoleType.Admin,
      annualLeaveAllowance: 28,
      departmentId: hr.id,
      managerId: null,
    })
  )

  const [engManager, finManager] = await userRepo.save([
    createUser({
      firstname: 'Bob',
      surname: 'Mitchell',
      email: 'bob.mitchell@company.com',
      password: defaultPassword,
      role: RoleType.Manager,
      annualLeaveAllowance: 28,
      departmentId: engineering.id,
      managerId: null,
    }),
    createUser({
      firstname: 'Carol',
      surname: 'Reyes',
      email: 'carol.reyes@company.com',
      password: defaultPassword,
      role: RoleType.Manager,
      annualLeaveAllowance: 28,
      departmentId: finance.id,
      managerId: null,
    }),
  ])

  const [emp1, emp2, emp3, emp4] = await userRepo.save([
    createUser({
      firstname: 'David',
      surname: 'Okafor',
      email: 'david.okafor@company.com',
      password: defaultPassword,
      role: RoleType.Employee,
      annualLeaveAllowance: 28,
      departmentId: engineering.id,
      managerId: engManager.id,
    }),
    createUser({
      firstname: 'Eve',
      surname: 'Nakamura',
      email: 'eve.nakamura@company.com',
      password: defaultPassword,
      role: RoleType.Employee,
      annualLeaveAllowance: 28,
      departmentId: engineering.id,
      managerId: engManager.id,
    }),
    createUser({
      firstname: 'Frank',
      surname: 'Harrison',
      email: 'frank.harrison@company.com',
      password: defaultPassword,
      role: RoleType.Employee,
      annualLeaveAllowance: 28,
      departmentId: finance.id,
      managerId: finManager.id,
    }),
    createUser({
      firstname: 'Grace',
      surname: 'Osei',
      email: 'grace.osei@company.com',
      password: defaultPassword,
      role: RoleType.Employee,
      annualLeaveAllowance: 25,
      departmentId: marketing.id,
      managerId: null,
    }),
  ])

  const createLeave = (data: SeedLeaveInput) =>
    leaveRepo.create({
      userId: data.userId,
      leaveType: data.leaveType,
      startDate: data.startDate,
      endDate: data.endDate,
      daysRequested: data.daysRequested,
      reason: data.reason,
      status: data.status,
      reviewedById: data.reviewedById,
    })

  await leaveRepo.save([
    createLeave({
      userId: emp1.id,
      leaveType: LeaveType.Vacation,
      startDate: new Date('2026-04-07'),
      endDate: new Date('2026-04-11'),
      daysRequested: 5,
      reason: 'Family holiday',
      status: LeaveStatus.Approved,
      reviewedById: engManager.id,
    }),
    createLeave({
      userId: emp1.id,
      leaveType: LeaveType.Sick,
      startDate: new Date('2026-05-01'),
      endDate: new Date('2026-05-02'),
      daysRequested: 2,
      reason: 'Feeling unwell',
      status: LeaveStatus.Pending,
      reviewedById: null,
    }),
    createLeave({
      userId: emp2.id,
      leaveType: LeaveType.Personal,
      startDate: new Date('2026-03-24'),
      endDate: new Date('2026-03-24'),
      daysRequested: 1,
      reason: 'Personal appointment',
      status: LeaveStatus.Rejected,
      reviewedById: engManager.id,
    }),
    createLeave({
      userId: emp3.id,
      leaveType: LeaveType.Vacation,
      startDate: new Date('2026-06-02'),
      endDate: new Date('2026-06-13'),
      daysRequested: 10,
      reason: 'Summer holiday',
      status: LeaveStatus.Approved,
      reviewedById: finManager.id,
    }),
    createLeave({
      userId: emp4.id,
      leaveType: LeaveType.Vacation,
      startDate: new Date('2026-04-14'),
      endDate: new Date('2026-04-18'),
      daysRequested: 5,
      reason: 'Easter break',
      status: LeaveStatus.Cancelled,
      reviewedById: null,
    }),
    createLeave({
      userId: emp2.id,
      leaveType: LeaveType.Vacation,
      startDate: new Date('2026-07-14'),
      endDate: new Date('2026-07-25'),
      daysRequested: 10,
      reason: 'Summer holiday',
      status: LeaveStatus.Pending,
      reviewedById: null,
    }),
  ])

  console.log('Seed complete.')
  console.log('\nDepartments: Engineering, Human Resources, Finance, Marketing')
  console.log('\nAccounts (password: Password123!)')
  console.log('  Admin:     alice.thompson@company.com')
  console.log('  Managers:  bob.mitchell@company.com, carol.reyes@company.com')
  console.log('  Employees: david.okafor, eve.nakamura, frank.harrison, grace.osei @company.com')

  await AppDataSource.destroy()
}

seed().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
