import { Body, Controller, HttpCode, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import type { JwtPayload } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { SESSION_COOKIE } from './jwt.strategy';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  private setSessionCookie(res: Response, token: string) {
    res.cookie(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
  }

  @Post('signup')
  @HttpCode(200)
  async signup(@Body() dto: SignupDto, @Res({ passthrough: true }) res: Response) {
    const { token, user } = await this.authService.signup(dto.username, dto.password);
    this.setSessionCookie(res, token);
    return { user };
  }

  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const { token, user } = await this.authService.login(dto.username, dto.password);
    this.setSessionCookie(res, token);
    return { user };
  }

  @Post('logout')
  @HttpCode(200)
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(SESSION_COOKIE);
    return { success: true };
  }

  @Post('change-password')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  async changePassword(
    @Req() req: Request,
    @Body() dto: ChangePasswordDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const currentUser = req.user as JwtPayload;
    const { token, user } = await this.authService.changePassword(
      currentUser.sub,
      dto.currentPassword,
      dto.newPassword,
    );
    this.setSessionCookie(res, token);
    return { user };
  }
}
