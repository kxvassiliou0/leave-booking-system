const mockLoggerInstance = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  verbose: jest.fn(),
}

jest.mock('winston', () => ({
  createLogger: jest.fn(() => mockLoggerInstance),
  format: {
    combine: jest.fn().mockReturnValue({}),
    timestamp: jest.fn().mockReturnValue({}),
    errors: jest.fn().mockReturnValue({}),
    splat: jest.fn().mockReturnValue({}),
    json: jest.fn().mockReturnValue({}),
  },
  transports: {
    File: jest.fn(),
  },
}))

import { Logger } from './Logger'

describe('Logger', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('delegates info() to the underlying winston logger', () => {
    Logger.info('test info', { key: 'value' })

    expect(mockLoggerInstance.info).toHaveBeenCalledWith('test info', {
      key: 'value',
    })
  })

  it('delegates error() to the underlying winston logger', () => {
    Logger.error('test error', { key: 'value' })

    expect(mockLoggerInstance.error).toHaveBeenCalledWith('test error', {
      key: 'value',
    })
  })

  it('delegates warn() to the underlying winston logger', () => {
    Logger.warn('test warn')

    expect(mockLoggerInstance.warn).toHaveBeenCalledWith('test warn', undefined)
  })

  it('delegates debug() to the underlying winston logger', () => {
    Logger.debug('test debug')

    expect(mockLoggerInstance.debug).toHaveBeenCalledWith(
      'test debug',
      undefined
    )
  })

  it('delegates trace() to verbose on the underlying winston logger', () => {
    Logger.trace('test trace')

    expect(mockLoggerInstance.verbose).toHaveBeenCalledWith(
      'test trace',
      undefined
    )
  })
})
