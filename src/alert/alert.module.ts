import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { AlertService } from './alert.service';

/**
 * Alert module
 * Provides alert service for threshold monitoring and webhook notifications
 */
@Module({
  imports: [
    HttpModule.register({
      timeout: 5000,
      maxRedirects: 2,
    }),
  ],
  providers: [AlertService],
  exports: [AlertService],
})
export class AlertModule {}
