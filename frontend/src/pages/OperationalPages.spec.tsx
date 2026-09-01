import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext, type AuthContextValue } from '../auth/auth-context';
import { ImportPage } from './ImportPage';
import { PosPage } from './PosPage';

const warehouse = {
  id: '22222222-2222-4222-8222-222222222222',
  name: 'Bodega principal',
};

function authenticated(requestMock: ReturnType<typeof vi.fn>): AuthContextValue {
  return {
    hasPermission: () => true,
    login: vi.fn(),
    logout: vi.fn(),
    request: requestMock as AuthContextValue['request'],
    status: 'authenticated',
    user: {
      email: 'admin@dtodopets.local',
      firstName: 'Admin',
      id: 'user-a',
      lastName: 'DTodoPets',
      organizationId: 'org-a',
      organizationSlug: 'dtodopets',
      permissions: ['pos.sell', 'imports.manage'],
      roles: ['owner'],
    },
  };
}

function renderPage(page: ReactNode, requestMock: ReturnType<typeof vi.fn>) {
  return render(
    <MemoryRouter>
      <AuthContext.Provider value={authenticated(requestMock)}>
        {page}
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}

describe('Operational pages', () => {
  it('builds and confirms a branch sale from the searchable catalog', async () => {
    const requestMock = vi.fn((path: string, options?: RequestInit) => {
      void options;
      if (path.startsWith('/warehouses')) return Promise.resolve({ data: [warehouse] });
      if (path.startsWith('/pos/catalog')) {
        return Promise.resolve({
          data: [
            {
              availableQuantity: 8,
              barcode: '780000000001',
              category: { id: 'category-a', name: 'Alimentos' },
              priceAmount: 12990,
              productName: 'Alimento perro adulto',
              sku: '780000000001',
              variantId: '33333333-3333-4333-8333-333333333333',
              variantName: null,
            },
          ],
          warehouse,
        });
      }
      if (path === '/pos/sales') {
        return Promise.resolve({
          cashChangeAmount: 10,
          idempotent: false,
          order: { id: 'order-a', number: 'POS-20260828-ABCD1234', totalAmount: '12990' },
        });
      }
      return Promise.reject(new Error(`Unexpected request: ${path}`));
    });
    const browser = userEvent.setup();
    renderPage(<PosPage />, requestMock);

    await browser.click(
      await screen.findByRole('button', { name: /Alimento perro adulto/i }),
    );
    expect(screen.getByText('Venta actual')).toBeVisible();
    expect(screen.getByRole('button', { name: /Confirmar venta/i })).toBeEnabled();
    await browser.click(screen.getByRole('button', { name: /Confirmar venta/i }));

    expect(await screen.findByText('POS-20260828-ABCD1234')).toBeVisible();
    const saleCall = requestMock.mock.calls.find(([path]) => path === '/pos/sales');
    expect(JSON.parse(String(saleCall?.[1]?.body))).toMatchObject({
      items: [{ quantity: 1, variantId: '33333333-3333-4333-8333-333333333333' }],
      payments: [{ amount: 12990, method: 'CASH', provider: 'Caja sucursal' }],
      warehouseId: warehouse.id,
    });
  });

  it('previews a RealBase spreadsheet before enabling its import', async () => {
    const requestMock = vi.fn((path: string, options?: RequestInit) => {
      void options;
      if (path.startsWith('/warehouses')) return Promise.resolve({ data: [warehouse] });
      if (path === '/imports/relbase/stock/preview') {
        return Promise.resolve({
          file: { name: 'stock.xlsx', size: 2048 },
          issues: [{ code: 'NEGATIVE_STOCK', message: 'Stock negativo', row: 12, severity: 'error' }],
          issuesTruncated: false,
          rows: [
            {
              active: true,
              barcode: '780000000001',
              category: 'Alimentos',
              grossPriceAmount: 12990,
              productName: 'Alimento perro adulto',
              row: 8,
              sku: '780000000001',
              stockQuantity: 4,
            },
          ],
          rowsTruncated: false,
          sheetName: 'Stock actual',
          summary: { blockingIssues: 1, inactiveRows: 0, negativeStockRows: 1, rows: 2, validRows: 1, warnings: 0 },
        });
      }
      return Promise.reject(new Error(`Unexpected request: ${path}`));
    });
    const browser = userEvent.setup();
    renderPage(<ImportPage />, requestMock);

    const file = new File(['workbook'], 'stock.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    await browser.upload(screen.getByLabelText(/Selecciona el Excel de stock/i), file);
    await browser.click(screen.getByRole('button', { name: 'Revisar archivo' }));

    expect(await screen.findByText('Filas bloqueadas')).toBeVisible();
    expect(screen.getByText('Stock negativo')).toBeVisible();
    expect(screen.getByRole('button', { name: /Aplicar 1 filas válidas/i })).toBeDisabled();
    await browser.click(screen.getByText('Omitir las filas bloqueadas'));
    expect(screen.getByRole('button', { name: /Aplicar 1 filas válidas/i })).toBeEnabled();
  });
});
