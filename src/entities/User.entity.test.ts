import { validate } from 'class-validator'
import { User } from './User.entity'
import { RoleType } from '../enums/RoleType.enum'

function makeValidUser(): User {
  const user = new User()
  user.firstName = 'Alice'
  user.lastName = 'Johnson'
  user.email = 'alice@company.com'
  user.password = 'password'
  user.role = RoleType.Employee
  user.annualLeaveAllowance = 28
  user.departmentId = 1
  return user
}

describe('User entity tests', () => {
  it('a valid user passes validation', async () => {
    const user = makeValidUser()
    const errors = await validate(user)
    expect(errors.length).toBe(0)
  })

  it('a blank firstName is considered invalid', async () => {
    const user = makeValidUser()
    user.firstName = ''

    const errors = await validate(user)

    expect(errors.length).toBeGreaterThan(0)
    expect(errors[0].constraints).toHaveProperty('isNotEmpty')
  })

  it('a blank lastName is considered invalid', async () => {
    const user = makeValidUser()
    user.lastName = ''

    const errors = await validate(user)

    expect(errors.length).toBeGreaterThan(0)
    expect(errors[0].constraints).toHaveProperty('isNotEmpty')
  })

  it('an invalid email format is considered invalid', async () => {
    const user = makeValidUser()
    user.email = 'not-an-email'

    const errors = await validate(user)

    expect(errors.length).toBeGreaterThan(0)
    expect(errors[0].constraints).toHaveProperty('isEmail')
  })

  it('an invalid role enum value is considered invalid', async () => {
    const user = makeValidUser()
    user.role = 'SuperAdmin' as RoleType

    const errors = await validate(user)

    expect(errors.length).toBeGreaterThan(0)
    expect(errors[0].constraints).toHaveProperty('isEnum')
  })

  it('a negative annualLeaveAllowance is considered invalid', async () => {
    const user = makeValidUser()
    user.annualLeaveAllowance = -5

    const errors = await validate(user)

    expect(errors.length).toBeGreaterThan(0)
    expect(errors[0].constraints).toHaveProperty('isPositive')
  })
})
