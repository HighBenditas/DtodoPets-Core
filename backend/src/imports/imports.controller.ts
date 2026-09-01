import {
  BadRequestException,
  Body,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { PERMISSIONS } from '../auth/permissions';
import { ApplyRelbaseStockDto } from './dto/apply-relbase-stock.dto';
import { ImportsService } from './imports.service';

const xlsxUpload = FileInterceptor('file', {
  limits: { fileSize: 10 * 1024 * 1024 },
});

@Controller('imports')
@RequirePermissions(PERMISSIONS.importsManage)
export class ImportsController {
  constructor(private readonly importsService: ImportsService) {}

  @Post('relbase/stock/preview')
  @UseInterceptors(xlsxUpload)
  preview(@UploadedFile() file: Express.Multer.File | undefined) {
    return this.importsService.preview(requiredFile(file));
  }

  @Post('relbase/stock/apply')
  @UseInterceptors(xlsxUpload)
  apply(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: ApplyRelbaseStockDto,
  ) {
    return this.importsService.apply(
      principal.organizationId,
      principal.id,
      requiredFile(file),
      dto,
    );
  }
}

function requiredFile(file: Express.Multer.File | undefined) {
  if (!file) throw new BadRequestException('Debes adjuntar un archivo Excel');
  if (!file.originalname.toLowerCase().endsWith('.xlsx')) {
    throw new BadRequestException('El archivo debe tener extensión .xlsx');
  }
  return file;
}
