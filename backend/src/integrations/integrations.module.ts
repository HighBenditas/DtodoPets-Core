import { Module } from '@nestjs/common';
import { CredentialsEncryptionService } from './credentials-encryption.service';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsService } from './integrations.service';

@Module({
  controllers: [IntegrationsController],
  providers: [CredentialsEncryptionService, IntegrationsService],
})
export class IntegrationsModule {}
