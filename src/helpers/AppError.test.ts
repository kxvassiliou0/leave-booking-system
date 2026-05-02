import { StatusCodes } from 'http-status-codes'
import { AppError } from './AppError'

describe('AppError', () => {
  it('sets message and statusCode from constructor arguments', () => {
    const err = new AppError('Something went wrong', StatusCodes.BAD_REQUEST)

    expect(err.message).toBe('Something went wrong')
    expect(err.statusCode).toBe(StatusCodes.BAD_REQUEST)
  })

  it('defaults statusCode to 500 when not provided', () => {
    const err = new AppError('Server error')

    expect(err.statusCode).toBe(StatusCodes.INTERNAL_SERVER_ERROR)
  })

  it('is an instance of Error', () => {
    const err = new AppError('test')

    expect(err).toBeInstanceOf(Error)
  })

  it('captures a stack trace', () => {
    const err = new AppError('test')

    expect(err.stack).toBeDefined()
  })
})
