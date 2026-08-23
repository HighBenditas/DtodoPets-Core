import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { CatalogModule } from './catalog/catalog.module';
import { CustomersModule } from './customers/customers.module';
import { HealthModule } from './health/health.module';
import { InventoryModule } from './inventory/inventory.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { LocationsModule } from './locations/locations.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { OrdersModule } from './orders/orders.module';
import { PaymentsModule } from './payments/payments.module';
import { ReturnsModule } from './returns/returns.module';
import { ShipmentsModule } from './shipments/shipments.module';
import { PrismaModule } from './prisma/prisma.module';
import { RolesModule } from './roles/roles.module';
import { UsersModule } from './users/users.module';
import { WarehousesModule } from './warehouses/warehouses.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    CatalogModule,
    CustomersModule,
    HealthModule,
    InventoryModule,
    IntegrationsModule,
    LocationsModule,
    OrganizationsModule,
    OrdersModule,
    PaymentsModule,
    ReturnsModule,
    ShipmentsModule,
    RolesModule,
    UsersModule,
    WarehousesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
