import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';

export interface JwtPayload {
  sub: string;
  username: string;
  role: 'ADMIN' | 'USER';
  vip: boolean;
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

  async login(username: string, password: string) {
    const user = await this.validateUser(username, password);
    const payload: JwtPayload = {
      sub: user.id,
      username: user.username,
      role: user.role,
      vip: user.vip,
    };
    return {
      token: this.jwtService.sign(payload),
      user: { id: user.id, username: user.username, role: user.role, vip: user.vip },
    };
  }
}
