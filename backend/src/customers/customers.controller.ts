import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { PERMISSIONS } from '../auth/permissions';
import { CustomersService } from './customers.service';
import { CreateCustomerAddressDto } from './dto/create-customer-address.dto';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { CustomerQueryDto } from './dto/customer-query.dto';
import { UpdateCustomerAddressDto } from './dto/update-customer-address.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

@Controller('customers')
@RequirePermissions(PERMISSIONS.customersRead)
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  findAll(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Query() query: CustomerQueryDto,
  ) {
    return this.customersService.findAll(principal.organizationId, query);
  }

  @Get(':id')
  findOne(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.customersService.findOne(principal.organizationId, id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.customersCreate)
  create(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Body() dto: CreateCustomerDto,
  ) {
    return this.customersService.create(principal.organizationId, dto);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.customersUpdate)
  update(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateCustomerDto,
  ) {
    return this.customersService.update(principal.organizationId, id, dto);
  }

  @Get(':id/addresses')
  findAddresses(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param('id', new ParseUUIDPipe({ version: '4' })) customerId: string,
  ) {
    return this.customersService.findAddresses(
      principal.organizationId,
      customerId,
    );
  }

  @Post(':id/addresses')
  @RequirePermissions(PERMISSIONS.customersUpdate)
  createAddress(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param('id', new ParseUUIDPipe({ version: '4' })) customerId: string,
    @Body() dto: CreateCustomerAddressDto,
  ) {
    return this.customersService.createAddress(
      principal.organizationId,
      customerId,
      dto,
    );
  }

  @Patch(':id/addresses/:addressId')
  @RequirePermissions(PERMISSIONS.customersUpdate)
  updateAddress(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param('id', new ParseUUIDPipe({ version: '4' })) customerId: string,
    @Param('addressId', new ParseUUIDPipe({ version: '4' })) addressId: string,
    @Body() dto: UpdateCustomerAddressDto,
  ) {
    return this.customersService.updateAddress(
      principal.organizationId,
      customerId,
      addressId,
      dto,
    );
  }

  @Put(':id/addresses/:addressId/default')
  @RequirePermissions(PERMISSIONS.customersUpdate)
  setDefaultAddress(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param('id', new ParseUUIDPipe({ version: '4' })) customerId: string,
    @Param('addressId', new ParseUUIDPipe({ version: '4' })) addressId: string,
  ) {
    return this.customersService.setDefaultAddress(
      principal.organizationId,
      customerId,
      addressId,
    );
  }
}
