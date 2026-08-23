import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/pagination/pagination-query.dto';
import {
  ExternalEntityType,
  SalesChannelType,
} from '../../generated/prisma/client';

const stableKeyPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class IntegrationQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}

export class CreateSalesChannelDto {
  @IsString()
  @Matches(stableKeyPattern)
  @MaxLength(100)
  key!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @IsEnum(SalesChannelType)
  type!: SalesChannelType;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class UpdateSalesChannelDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class CreateIntegrationDto {
  @IsString()
  @Matches(stableKeyPattern)
  @MaxLength(100)
  key!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  provider!: string;

  @IsOptional()
  @IsUUID('4')
  salesChannelId?: string;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  credentials?: Record<string, unknown>;
}

export class UpdateIntegrationDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsUUID('4')
  salesChannelId?: string;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  credentials?: Record<string, unknown>;
}

export class CreateExternalReferenceDto {
  @IsEnum(ExternalEntityType)
  entityType!: ExternalEntityType;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  entityId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  externalId!: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class ReceiveWebhookDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  externalEventId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  eventType!: string;

  @IsObject()
  payload!: Record<string, unknown>;
}
