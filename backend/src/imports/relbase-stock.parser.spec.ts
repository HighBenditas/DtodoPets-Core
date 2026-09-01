import { Workbook } from 'exceljs';
import { isValidImportRow, parseRelbaseStock } from './relbase-stock.parser';

describe('parseRelbaseStock', () => {
  it('maps the relBase template, preserves identifiers and calculates gross CLP', async () => {
    const workbook = new Workbook();
    const sheet = workbook.addWorksheet('Stock actual');
    sheet.getRow(6).values = [
      'Ubicación',
      'Categoría',
      'Tipo',
      'Producto',
      'Código',
      'Estado',
      'Código barra',
      'Stock disponible',
      'Bodega principal',
      'Costo promedio',
      'Total',
      'Precio neto',
      'Proveedor',
      'Vencimiento',
    ];
    sheet.getRow(7).values = [
      'Bodega principal:',
      'Alimento Seco - Gato Adulto',
      'Producto',
      'Agility Urinary Gatos 11Kg',
      7798075341380,
      'Vigente',
      7798075341380,
      15,
      15,
      32742,
      491130,
      36890.7,
      'Proveedor Uno',
      '',
    ];
    sheet.getRow(8).values = [
      'Bodega principal:',
      'Snack',
      'Producto',
      'Patitas deshidratadas',
      'SP-4P-785046',
      'Vigente',
      'SP-4P-785046',
      2,
      2,
      0,
      0,
      4201.68,
      '',
      '',
    ];

    const parsed = await parseRelbaseStock(
      Buffer.from(await workbook.xlsx.writeBuffer()),
    );

    expect(parsed.summary).toMatchObject({
      blockingIssues: 0,
      rows: 2,
      validRows: 2,
    });
    expect(parsed.rows[0]).toMatchObject({
      barcode: '7798075341380',
      grossPriceAmount: 43900,
      sku: '7798075341380',
      stockQuantity: 15,
    });
    expect(parsed.rows[1]?.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'BARCODE_ALPHANUMERIC',
          severity: 'info',
        }),
        expect.objectContaining({ code: 'COST_MISSING', severity: 'warning' }),
      ]),
    );
  });

  it('blocks negative stock and every row that shares a duplicate barcode', async () => {
    const workbook = new Workbook();
    const sheet = workbook.addWorksheet('Stock actual');
    sheet.addRow([
      'Categoría',
      'Producto',
      'Código',
      'Código barra',
      'Stock disponible',
      'Costo promedio',
      'Precio neto',
      'Proveedor',
    ]);
    sheet.addRow([
      'Salud',
      'Producto A',
      'A-1',
      '12345678',
      -1,
      100,
      1000,
      'P',
    ]);
    sheet.addRow(['Salud', 'Producto B', 'B-1', '12345678', 1, 100, 1000, 'P']);

    const parsed = await parseRelbaseStock(
      Buffer.from(await workbook.xlsx.writeBuffer()),
    );

    expect(parsed.summary.blockingIssues).toBe(3);
    expect(parsed.rows.every((row) => !isValidImportRow(row))).toBe(true);
    expect(
      parsed.issues.filter(({ code }) => code === 'BARCODE_DUPLICATE'),
    ).toHaveLength(2);
  });
});
