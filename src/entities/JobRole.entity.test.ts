import { validate } from 'class-validator'
import { JobRole } from './JobRole.entity'

describe('JobRole entity tests', () => {
  it('A blank name is considered invalid', async () => {
    const jobRole = new JobRole()
    jobRole.name = ''

    const errors = await validate(jobRole)

    expect(errors.length).toBeGreaterThan(0)
    expect(errors[0].constraints).toHaveProperty('isNotEmpty')
  })

  it('A name containing only spaces is considered invalid', async () => {
    const jobRole = new JobRole()
    jobRole.name = '   '

    const errors = await validate(jobRole)

    expect(errors.length).toBeGreaterThan(0)
    expect(errors[0].constraints).toHaveProperty('matches')
  })

  it('A name exceeding 30 characters is considered invalid', async () => {
    const jobRole = new JobRole()
    jobRole.name = 'a'.repeat(31)

    const errors = await validate(jobRole)

    expect(errors.length).toBeGreaterThan(0)
    expect(errors[0].constraints).toHaveProperty('maxLength')
  })

  it('A valid name will be accepted', async () => {
    const jobRole = new JobRole()
    jobRole.name = 'Senior Contractor'

    const errors = await validate(jobRole)

    expect(errors.length).toBe(0)
  })
})
