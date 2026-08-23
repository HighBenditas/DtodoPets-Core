import { Module } from '@nestjs/common';
import { OrdersModule } from '../orders/orders.module';
import { MercadoLibreController } from './mercado-libre.controller';
import { MercadoLibreService } from './mercado-libre.service';

@Module({
  imports: [OrdersModule],
  controllers: [MercadoLibreController],
  providers: [MercadoLibreService],
})
export class MercadoLibreModule {}
