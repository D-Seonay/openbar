import type { JwtPayload } from './auth.service';

export function canSeeVip(user?: JwtPayload): boolean {
  return user?.role === 'ADMIN' || user?.vip === true;
}
