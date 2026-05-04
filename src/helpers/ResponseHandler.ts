import type { Response } from "express";

export class ResponseHandler {
  static sendSuccessResponse(
    res: Response,
    data: unknown,
    statusCode = 200,
  ): void {
    res.status(statusCode).json({ data });
  }

  static sendErrorResponse(
    res: Response,
    statusCode: number,
    message = "An error occurred",
  ): void {
    res.status(statusCode).json({ error: message });
  }
}
