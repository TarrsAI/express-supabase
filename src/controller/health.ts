import type { Request, Response } from 'express';
import response from '../utility/response.js';
import { HTTP_STATUS_CODE } from '../utility/httpStatusCode.js';

export const health = (_req: Request, res: Response): void => {
  response(res, HTTP_STATUS_CODE.OK, undefined, {
    status: 'ok',
    uptime: process.uptime(),
  });
};
