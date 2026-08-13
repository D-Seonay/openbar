import type { NextFunction, Request, Response } from 'express';
import type { JwtPayload } from '../../auth/auth.service';

/** Paths that would otherwise fill the log with nothing. */
const IGNORED_PATHS = new Set(['/health']);

export interface HttpLogLine {
  level: 'info' | 'warn' | 'error';
  msg: 'http';
  time: string;
  requestId: string;
  method: string;
  path: string;
  status: number;
  ms: number;
  bytes?: number;
  userId?: string;
  role?: string;
  ip?: string;
}

/**
 * One structured line per request, written when the response finishes.
 *
 * Deliberately middleware rather than a Nest interceptor: guards run *before*
 * interceptors, so an interceptor never sees a request the JWT guard rejected —
 * and a 401 is exactly the kind of thing worth having in a log. Listening for
 * `finish` also catches routes that never reach a controller at all, such as a
 * 404, and reports the status actually sent.
 *
 * The request body is never read. It would capture passwords on `/auth/login`
 * and `/auth/change-password`, and a log is the wrong place to learn that.
 * Query strings are dropped for the same reason.
 */
export function httpLogging(req: Request, res: Response, next: NextFunction) {
  const path = req.path;
  if (IGNORED_PATHS.has(path)) return next();

  const startedAt = process.hrtime.bigint();

  res.on('finish', () => {
    const status = res.statusCode;
    // `req.user` is populated by the JWT guard, which has run by the time the
    // response finishes, so authenticated calls are attributed.
    const user = req.user as JwtPayload | undefined;
    const bytes = Number(res.getHeader('content-length') ?? 0);

    const line: HttpLogLine = {
      level: status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info',
      msg: 'http',
      time: new Date().toISOString(),
      requestId: (req as Request & { requestId?: string }).requestId ?? '-',
      method: req.method,
      path,
      status,
      ms: Number(process.hrtime.bigint() - startedAt) / 1e6,
      ...(Number.isFinite(bytes) && bytes > 0 ? { bytes } : {}),
      ...(user?.sub ? { userId: user.sub, role: user.role } : {}),
      ...(req.ip ? { ip: req.ip } : {}),
    };

    // Straight to stdout: Nest's logger would wrap this in its own prefix and
    // colours, which stops it being parseable.
    process.stdout.write(`${JSON.stringify(line)}\n`);
  });

  next();
}
