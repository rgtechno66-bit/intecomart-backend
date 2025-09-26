// dashboard.controller.ts
import { Controller, Get, InternalServerErrorException, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { SessionGuard } from './../jwt/session.guard';
import { JwtAuthGuard } from './../jwt/jwt-auth.guard';

@Controller('dashboard')
// @UseGuards(SessionGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}
  
  @Get('data')
  async getDashboardData() {
    try {
      return await this.dashboardService.getDashboardData();
    } catch (error) {
      throw new InternalServerErrorException('Failed to fetch dashboard data');
    }
  }
}
