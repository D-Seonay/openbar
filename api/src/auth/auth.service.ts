import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';

/** How long a "rester connecté" session lasts, matching the cookie's maxAge. */
export const REMEMBERED_SESSION = '30d';

/**
 * Admin sessions are capped at a day on purpose: they can archive accounts and
 * reach every bar. This is what made an admin look "logged out automatically"
 * every morning, and only an explicit "rester connecté" lifts it.
 */
export const ADMIN_SESSION = '24h';

/** Everyone else, unchanged. */
export const DEFAULT_SESSION = '30d';

export interface JwtPayload {
  sub: string;
  username: string;
  role: 'ADMIN' | 'USER';
  vip: boolean;
  mustChangePassword: boolean;
  /** Whether the person asked to stay signed in. See `issueToken`. */
  remember?: boolean;
}

interface AuthenticatedUser {
  id: string;
  username: string;
  role: 'ADMIN' | 'USER';
  vip: boolean;
  mustChangePassword: boolean;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  private async validateUser(username: string, password: string) {
    const user = await this.usersService.findByUsername(username);
    if (!user) throw new UnauthorizedException('Identifiants invalides');
    const matches = await bcrypt.compare(password, user.passwordHash);
    if (!matches) throw new UnauthorizedException('Identifiants invalides');
    return user;
  }

  /**
   * Mint a session token.
   *
   * `remember` defaults to false, which reproduces the previous behaviour
   * exactly: nothing gets a longer session than before unless the person ticked
   * the box. It is carried in the payload so a re-issue (password change) does
   * not silently demote a remembered session back to a day.
   */
  private issueToken(user: AuthenticatedUser, remember = false) {
    const payload: JwtPayload = {
      sub: user.id,
      username: user.username,
      role: user.role,
      vip: user.vip,
      mustChangePassword: user.mustChangePassword,
      remember,
    };
    const expiresIn = remember
      ? REMEMBERED_SESSION
      : user.role === 'ADMIN'
        ? ADMIN_SESSION
        : DEFAULT_SESSION;
    return {
      token: this.jwtService.sign(payload, { expiresIn }),
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        vip: user.vip,
      },
    };
  }

  async login(username: string, password: string, remember = false) {
    const user = await this.validateUser(username, password);
    return this.issueToken(user, remember);
  }

  async signup(username: string, password: string, remember = false) {
    const user = await this.usersService.create({ username, password });
    return this.issueToken(user, remember);
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    remember = false,
  ) {
    const user = await this.usersService.findById(userId);
    if (!user) throw new UnauthorizedException('Utilisateur introuvable');

    const matches = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!matches)
      throw new UnauthorizedException('Mot de passe actuel incorrect');

    await this.usersService.update(userId, {
      password: newPassword,
      mustChangePassword: false,
    });
    return this.issueToken(
      {
        id: user.id,
        username: user.username,
        role: user.role,
        vip: user.vip,
        mustChangePassword: false,
      },
      remember,
    );
  }

  async getProfile(userId: string) {
    const user = await this.usersService.findPublicById(userId);
    if (!user) throw new UnauthorizedException('Utilisateur introuvable');
    return user;
  }

  async updateProfile(
    userId: string,
    input: {
      birthday?: string;
      favoriteDrink?: string;
      allergies?: string;
      avatarUrl?: string;
    },
  ) {
    const user = await this.usersService.findPublicById(userId);
    if (!user) throw new UnauthorizedException('Utilisateur introuvable');
    return this.usersService.updateProfile(userId, input);
  }
}
