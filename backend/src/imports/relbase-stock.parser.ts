import { BadRequestException } from '@nestjs/common';
import { Workbook, type Cell, type Worksheet } from 'exceljs';

export type ImportIssueSeverity = 'error' | 'info' | 'warning';

export interface ImportIssue {
  code: string;
  message: string;
  row: number;
  severity: ImportIssueSeverity;
}

export interface RelbaseStockRow {
  active: boolean;
  barcode: string | null;
  category: string;
  costAmount: number;
  grossPriceAmount: number;
  issues: ImportIssue[];
  netPriceAmount: number;
  productName: string;
  provider: string | null;
  row: number;
  sku: string;
  sourceCode: string;
  stockQuantity: number;
}

export interface ParsedRelbaseStock {
  issues: ImportIssue[];
  rows: RelbaseStockRow[];
  sheetName: string;
  summary: {
    blockingIssues: number;
    inactiveRows: number;
    negativeStockRows: number;
    rows: number;
    validRows: number;
    warnings: number;
  };
}

const headerAliases = {
  barcode: ['codigo barra', 'codigo de barra', 'codigo barras'],
  category: ['categoria'],
  cost: ['costo promedio'],
  product: ['producto'],
  provider: ['proveedor'],
  sourceCode: ['codigo'],
  stock: ['stock disponible'],
  netPrice: ['precio neto'],
} as const;

type HeaderKey = keyof typeof headerAliases;
type HeaderMap = Record<HeaderKey, number>;

export async function parseRelbaseStock(
  file: Buffer,
): Promise<ParsedRelbaseStock> {
  const workbook = new Workbook();
  try {
    await workbook.xlsx.load(
      file as unknown as Parameters<typeof workbook.xlsx.load>[0],
    );
  } catch {
    throw new BadRequestException('El archivo no es un Excel .xlsx válido');
  }

  const sheet =
    workbook.worksheets.find(
      (candidate) => normalize(candidate.name) === 'stock actual',
    ) ?? workbook.worksheets[0];
  if (!sheet) {
    throw new BadRequestException('El Excel no contiene hojas para importar');
  }

  const { headerRow, columns } = findHeaders(sheet);
  const rows: RelbaseStockRow[] = [];

  for (
    let rowNumber = headerRow + 1;
    rowNumber <= sheet.rowCount;
    rowNumber++
  ) {
    const row = sheet.getRow(rowNumber);
    const productName = text(row.getCell(columns.product));
    const sourceCode = identifier(row.getCell(columns.sourceCode));
    const barcode = identifier(row.getCell(columns.barcode)) || null;
    if (!productName && !sourceCode && !barcode) continue;

    const issues: ImportIssue[] = [];
    const category = text(row.getCell(columns.category)) || 'Sin categoría';
    const stockQuantity = integer(row.getCell(columns.stock));
    const costAmount = money(row.getCell(columns.cost));
    const netPriceAmount = money(row.getCell(columns.netPrice));

    if (!productName) {
      issues.push(
        issue(rowNumber, 'PRODUCT_REQUIRED', 'Falta el nombre del producto'),
      );
    }
    if (!sourceCode) {
      issues.push(
        issue(
          rowNumber,
          'SOURCE_CODE_REQUIRED',
          'Falta el código interno de relBase',
        ),
      );
    }
    if (!Number.isSafeInteger(stockQuantity)) {
      issues.push(
        issue(rowNumber, 'STOCK_INVALID', 'El stock debe ser un número entero'),
      );
    } else if (stockQuantity < 0) {
      issues.push(
        issue(
          rowNumber,
          'NEGATIVE_STOCK',
          'El stock negativo debe corregirse antes de importar',
        ),
      );
    }
    if (!Number.isFinite(netPriceAmount) || netPriceAmount <= 0) {
      issues.push(
        issue(
          rowNumber,
          'PRICE_INVALID',
          'El precio neto debe ser mayor que cero',
        ),
      );
    }
    if (!barcode) {
      issues.push(
        issue(
          rowNumber,
          'BARCODE_MISSING',
          'Sin código de barras; se utilizará el código interno como SKU',
          'warning',
        ),
      );
    } else if (!/^\d+$/.test(barcode)) {
      issues.push(
        issue(
          rowNumber,
          'BARCODE_ALPHANUMERIC',
          'El identificador alfanumérico se conservará como texto',
          'info',
        ),
      );
    }
    if (stockQuantity > 0 && costAmount <= 0) {
      issues.push(
        issue(
          rowNumber,
          'COST_MISSING',
          'Hay stock positivo sin costo promedio',
          'warning',
        ),
      );
    }

    rows.push({
      active: normalize(category) !== 'z inactivo',
      barcode,
      category,
      costAmount: Math.max(0, Math.round(costAmount || 0)),
      grossPriceAmount: Math.round((netPriceAmount || 0) * 1.19),
      issues,
      netPriceAmount,
      productName,
      provider: text(row.getCell(columns.provider)) || null,
      row: rowNumber,
      sku: (barcode || sourceCode).toUpperCase(),
      sourceCode,
      stockQuantity,
    });
  }

  if (rows.length === 0) {
    throw new BadRequestException('La hoja de stock no contiene productos');
  }

  markDuplicates(
    rows,
    'sourceCode',
    'SOURCE_CODE_DUPLICATE',
    'Código interno duplicado',
  );
  markDuplicates(
    rows,
    'barcode',
    'BARCODE_DUPLICATE',
    'Código de barras duplicado',
  );

  const issues = rows.flatMap((row) => row.issues);
  return {
    issues,
    rows,
    sheetName: sheet.name,
    summary: {
      blockingIssues: issues.filter(({ severity }) => severity === 'error')
        .length,
      inactiveRows: rows.filter(({ active }) => !active).length,
      negativeStockRows: rows.filter(({ stockQuantity }) => stockQuantity < 0)
        .length,
      rows: rows.length,
      validRows: rows.filter(isValidImportRow).length,
      warnings: issues.filter(({ severity }) => severity === 'warning').length,
    },
  };
}

export function isValidImportRow(row: RelbaseStockRow) {
  return !row.issues.some(({ severity }) => severity === 'error');
}

function findHeaders(sheet: Worksheet) {
  const maximumRow = Math.min(sheet.rowCount, 25);
  for (let rowNumber = 1; rowNumber <= maximumRow; rowNumber++) {
    const found = new Map<HeaderKey, number>();
    const row = sheet.getRow(rowNumber);
    for (let column = 1; column <= Math.max(row.cellCount, 20); column++) {
      const value = normalize(text(row.getCell(column)));
      for (const [key, aliases] of Object.entries(headerAliases) as Array<
        [HeaderKey, readonly string[]]
      >) {
        if (aliases.includes(value)) found.set(key, column);
      }
    }
    if (found.size === Object.keys(headerAliases).length) {
      return {
        columns: Object.fromEntries(found) as HeaderMap,
        headerRow: rowNumber,
      };
    }
  }
  throw new BadRequestException(
    'No encontramos las columnas requeridas de la plantilla de stock de relBase',
  );
}

function markDuplicates(
  rows: RelbaseStockRow[],
  field: 'barcode' | 'sourceCode',
  code: string,
  label: string,
) {
  const grouped = new Map<string, RelbaseStockRow[]>();
  for (const row of rows) {
    const value = row[field];
    if (!value) continue;
    const key = value.toUpperCase();
    grouped.set(key, [...(grouped.get(key) ?? []), row]);
  }
  for (const [value, duplicates] of grouped) {
    if (duplicates.length < 2) continue;
    for (const row of duplicates) {
      row.issues.push(
        issue(row.row, code, `${label}: ${value} (${duplicates.length} filas)`),
      );
    }
  }
}

function issue(
  row: number,
  code: string,
  message: string,
  severity: ImportIssueSeverity = 'error',
): ImportIssue {
  return { code, message, row, severity };
}

function identifier(cell: Cell) {
  const value = cell.value;
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Number.isInteger(value) ? String(value) : cell.text.trim();
  }
  return text(cell);
}

function integer(cell: Cell) {
  const value = numeric(cell);
  return Number.isInteger(value) ? value : Number.NaN;
}

function money(cell: Cell) {
  const value = numeric(cell);
  return Number.isFinite(value) ? value : Number.NaN;
}

function numeric(cell: Cell) {
  const value = cell.value;
  if (typeof value === 'number') return value;
  if (value && typeof value === 'object' && 'result' in value) {
    const result = value.result;
    if (typeof result === 'number') return result;
  }
  const raw = cell.text.trim().replace(/[$\s]/g, '');
  if (!raw) return 0;
  const normalized = raw.includes(',')
    ? raw.replace(/\./g, '').replace(',', '.')
    : raw;
  return Number(normalized);
}

function text(cell: Cell) {
  return cell.text.trim();
}

function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}
