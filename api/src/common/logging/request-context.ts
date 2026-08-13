import { randomUUID } from 'crypto';
import type { NextFunction, Request, Response } from 'express';

export const REQUEST_ID_HEADER = 'x-request-id';

/**
 * Give every request an id, and echo it back on the response.
 *
 * One id lets a report ("it failed around 21h") be traced to a single line in
 * the logs. An id supplied by a caller is honoured so a chain of requests keeps
 * one identifier — but it is truncated, because it ends up in a log line and in
 * a response header, and neither should be a place a client can dump kilobytes.
 */
export function requestContext(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const supplied = req.headers[REQUEST_ID_HEADER];
  const candidate = Array.isArray(supplied) ? supplied[0] : supplied;
  const requestId = candidate?.trim().slice(0, 64) || randomUUID();

  (req as Request & { requestId?: string }).requestId = requestId;
  res.setHeader(REQUEST_ID_HEADER, requestId);
  next();
}
