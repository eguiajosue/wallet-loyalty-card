import 'reflect-metadata';
import { Body, Controller, Get, Headers, Inject, Module, Param, Post, HttpCode } from '@nestjs/common';
import { AuthService } from './auth';
import { Database } from './db';
import { LoyaltyService } from './loyalty';

@Controller()
class AppController {
  constructor(@Inject(AuthService) private readonly auth: AuthService,
    @Inject(LoyaltyService) private readonly loyalty: LoyaltyService,
    @Inject(Database) private readonly db: Database) {}

  @Get('health')
  async health() { await this.db.query('SELECT 1'); return { status: 'ok' }; }

  @Post('auth/register')
  register(@Body() body: unknown) { return this.auth.register(body); }

  @Post('auth/login')
  @HttpCode(200)
  login(@Body() body: unknown) { return this.auth.login(body); }

  @Post('auth/logout')
  @HttpCode(200)
  logout(@Headers('authorization') authorization: string | undefined) { return this.auth.logout(authorization); }

  @Post('tenants/:tenantId/campaigns')
  createCampaign(@Param('tenantId') tenantId: string, @Headers('authorization') authorization: string | undefined, @Body() body: unknown) {
    return this.loyalty.createCampaign(tenantId, authorization, body);
  }

  @Get('tenants/:tenantId/campaigns')
  campaigns(@Param('tenantId') tenantId: string, @Headers('authorization') authorization: string | undefined) {
    return this.loyalty.listCampaigns(tenantId, authorization);
  }

  @Post('campaigns/:campaignId/enrollments')
  enroll(@Param('campaignId') campaignId: string) { return this.loyalty.enroll(campaignId); }

  @Get('cards/:token')
  card(@Param('token') token: string) { return this.loyalty.getCard(token); }

  @Post('tenants/:tenantId/enrollments/:token/visits')
  visit(@Param('tenantId') tenantId: string, @Param('token') token: string,
    @Headers('authorization') authorization: string | undefined,
    @Headers('idempotency-key') key: string | undefined, @Body() body: unknown) {
    return this.loyalty.visit(tenantId, token, authorization, key, body);
  }
}

@Module({ controllers: [AppController], providers: [Database, AuthService, LoyaltyService] })
export class AppModule {}
