import type { Response } from 'express'
import { StatusCodes } from 'http-status-codes'
import { ResponseHandler } from './ResponseHandler'

function mockResponse(): Response {
  const res = {} as Response
  res.status = jest.fn().mockReturnValue(res)
  res.json = jest.fn().mockReturnValue(res)
  return res
}

describe('ResponseHandler', () => {
  describe('sendSuccessResponse', () => {
    it('sends 200 with data wrapped in a data key by default', () => {
      const res = mockResponse()

      ResponseHandler.sendSuccessResponse(res, { id: 1 })

      expect(res.status).toHaveBeenCalledWith(200)
      expect(res.json).toHaveBeenCalledWith({ data: { id: 1 } })
    })

    it('sends the provided status code', () => {
      const res = mockResponse()

      ResponseHandler.sendSuccessResponse(res, { id: 1 }, StatusCodes.CREATED)

      expect(res.status).toHaveBeenCalledWith(StatusCodes.CREATED)
      expect(res.json).toHaveBeenCalledWith({ data: { id: 1 } })
    })
  })

  describe('sendErrorResponse', () => {
    it('sends the provided status code and message wrapped in an error key', () => {
      const res = mockResponse()

      ResponseHandler.sendErrorResponse(res, StatusCodes.NOT_FOUND, 'Not found')

      expect(res.status).toHaveBeenCalledWith(StatusCodes.NOT_FOUND)
      expect(res.json).toHaveBeenCalledWith({ error: 'Not found' })
    })

    it('sends a default message when none is provided', () => {
      const res = mockResponse()

      ResponseHandler.sendErrorResponse(res, StatusCodes.INTERNAL_SERVER_ERROR)

      expect(res.json).toHaveBeenCalledWith({ error: 'An error occurred' })
    })
  })
})
