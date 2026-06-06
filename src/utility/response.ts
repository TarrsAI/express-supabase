import type { Response } from 'express';
import { HTTP_STATUS_CODE } from './httpStatusCode.js';

/**
 * Single response envelope used by every controller. Stable shape on
 * the wire means the frontend never needs to special-case "success
 * with data" vs "error with message" — there's exactly one parse path.
 *
 *   {
 *     success: true | false,
 *     message: string | undefined,
 *     data: T | null,
 *     debug?: { type, stack },   // dev-only
 *     code?: string              // optional structured error code
 *   }
 */
export interface ResponseEnvelope<T = unknown> {
  success: boolean;
  message: string | undefined;
  data: T | null;
  debug?: { type?: string; stack?: string };
  code?: string;
}

const response = <T>(
  res: Response,
  statusCode: number = HTTP_STATUS_CODE.OK,
  message?: string,
  data: T | null = null,
  debug?: { type?: string; stack?: string },
  code?: string | null,
): Response => {
  const body: ResponseEnvelope<T> = {
    success: statusCode >= 200 && statusCode < 400,
    message,
    data,
  };
  if (debug) body.debug = debug;
  if (code) body.code = code;
  return res.status(statusCode).json(body);
};

export default response;
