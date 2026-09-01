import {
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  LoaderCircle,
  UploadCloud,
} from 'lucide-react';
import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { useAuth } from '../auth/use-auth';

interface Warehouse {
  id: string;
  name: string;
}

interface WarehousePage {
  data: Warehouse[];
}

type IssueSeverity = 'error' | 'info' | 'warning';

interface ImportIssue {
  code: string;
  message: string;
  row: number;
  severity: IssueSeverity;
}

interface PreviewRow {
  active: boolean;
  barcode: string | null;
  category: string;
  grossPriceAmount: number;
  productName: string;
  row: number;
  sku: string;
  stockQuantity: number;
}

interface ImportPreview {
  file: { name: string; size: number };
  issues: ImportIssue[];
  issuesTruncated: boolean;
  rows: PreviewRow[];
  rowsTruncated: boolean;
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

interface ImportResult {
  created: number;
  inventoryAdjusted: number;
  operationId: string;
  skipped: number;
  totalRows: number;
  unchanged: number;
  updated: number;
  warehouse: Warehouse;
}

const clp = new Intl.NumberFormat('es-CL', {
  currency: 'CLP',
  maximumFractionDigits: 0,
  style: 'currency',
});

export function ImportPage() {
  const { request } = useAuth();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [warehouseId, setWarehouseId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [skipInvalidRows, setSkipInvalidRows] = useState(false);
  const [busy, setBusy] = useState<'apply' | 'preview' | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void request<WarehousePage>('/warehouses?page=1&limit=100&active=true')
      .then(({ data }) => {
        if (!active) return;
        setWarehouses(data);
        setWarehouseId((current) => current || data[0]?.id || '');
      })
      .catch((reason: unknown) => {
        if (active) setError(messageOf(reason));
      });
    return () => {
      active = false;
    };
  }, [request]);

  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    setFile(event.target.files?.[0] ?? null);
    setPreview(null);
    setResult(null);
    setSkipInvalidRows(false);
    setError(null);
  }

  async function previewFile(event: FormEvent) {
    event.preventDefault();
    if (!file) return;
    setBusy('preview');
    setError(null);
    setResult(null);
    try {
      const form = new FormData();
      form.append('file', file);
      setPreview(
        await request<ImportPreview>('/imports/relbase/stock/preview', {
          body: form,
          method: 'POST',
        }),
      );
    } catch (reason) {
      setError(messageOf(reason));
    } finally {
      setBusy(null);
    }
  }

  async function applyImport() {
    if (!file || !warehouseId || !preview) return;
    setBusy('apply');
    setError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('warehouseId', warehouseId);
      form.append('skipInvalidRows', String(skipInvalidRows));
      const nextResult = await request<ImportResult>(
        '/imports/relbase/stock/apply',
        { body: form, method: 'POST' },
      );
      setResult(nextResult);
      setPreview(null);
    } catch (reason) {
      setError(messageOf(reason));
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="operation-page import-page">
      <header className="page-heading page-heading--top">
        <div>
          <p className="eyebrow">Inventario · RealBase</p>
          <h1>Importar stock</h1>
          <p>
            Revisa la plantilla antes de modificar productos y existencias. La
            carga se aplica completa dentro de una sola transacción.
          </p>
        </div>
        <span className="connection-badge">
          <span /> Vista previa segura
        </span>
      </header>

      <form className="surface-card import-upload" onSubmit={previewFile}>
        <label className="file-drop" htmlFor="stock-file">
          <UploadCloud size={27} />
          <span>
            <strong>{file?.name ?? 'Selecciona el Excel de stock'}</strong>
            <small>Plantilla .xlsx exportada desde RealBase</small>
          </span>
          <input
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            id="stock-file"
            onChange={chooseFile}
            type="file"
          />
        </label>
        <label className="compact-field">
          <span>Bodega de destino</span>
          <select
            disabled={warehouses.length === 0}
            onChange={(event) => setWarehouseId(event.target.value)}
            value={warehouseId}
          >
            {warehouses.map((warehouse) => (
              <option key={warehouse.id} value={warehouse.id}>
                {warehouse.name}
              </option>
            ))}
          </select>
        </label>
        <button
          className="primary-button action-button"
          disabled={!file || !warehouseId || busy !== null}
          type="submit"
        >
          {busy === 'preview' ? (
            <LoaderCircle className="spin" size={18} />
          ) : (
            <FileSpreadsheet size={18} />
          )}
          Revisar archivo
        </button>
      </form>

      {error && <div className="inline-alert inline-alert--error">{error}</div>}

      {result && (
        <article className="surface-card success-panel" role="status">
          <CheckCircle2 size={28} />
          <div>
            <p className="eyebrow">Importación completada</p>
            <h2>{result.warehouse.name} quedó actualizada</h2>
            <p>
              {result.created} productos creados, {result.updated} actualizados y{' '}
              {result.inventoryAdjusted} saldos ajustados. Se omitieron{' '}
              {result.skipped} filas.
            </p>
          </div>
        </article>
      )}

      {preview && (
        <>
          <section className="metric-grid" aria-label="Resumen de la revisión">
            <Metric label="Filas detectadas" value={preview.summary.rows} />
            <Metric label="Listas para importar" tone="good" value={preview.summary.validRows} />
            <Metric label="Filas bloqueadas" tone="danger" value={preview.summary.blockingIssues} />
            <Metric label="Advertencias" tone="warning" value={preview.summary.warnings} />
          </section>

          <section className="surface-card review-card">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Resultado de la revisión</p>
                <h2>{preview.file.name}</h2>
                <p>Hoja “{preview.sheetName}” · {formatBytes(preview.file.size)}</p>
              </div>
              <button
                className="primary-button action-button"
                disabled={
                  busy !== null ||
                  (preview.summary.blockingIssues > 0 && !skipInvalidRows)
                }
                onClick={() => void applyImport()}
                type="button"
              >
                {busy === 'apply' && <LoaderCircle className="spin" size={18} />}
                Aplicar {preview.summary.validRows} filas válidas
              </button>
            </div>

            {preview.summary.blockingIssues > 0 && (
              <label className="confirmation-box">
                <input
                  checked={skipInvalidRows}
                  onChange={(event) => setSkipInvalidRows(event.target.checked)}
                  type="checkbox"
                />
                <span>
                  <strong>Omitir las filas bloqueadas</strong>
                  <small>
                    No se importarán filas con stock negativo, códigos duplicados
                    u otros errores. Podrás corregirlas en RealBase después.
                  </small>
                </span>
              </label>
            )}

            {preview.issues.length > 0 && (
              <div className="issue-list">
                {preview.issues.map((issue, index) => (
                  <div className={`issue-row issue-row--${issue.severity}`} key={`${issue.row}-${issue.code}-${index}`}>
                    <AlertTriangle size={16} />
                    <strong>Fila {issue.row}</strong>
                    <span>{issue.message}</span>
                  </div>
                ))}
                {preview.issuesTruncated && <small>Se muestran las primeras 250 observaciones.</small>}
              </div>
            )}

            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Fila</th>
                    <th>Producto</th>
                    <th>SKU / código</th>
                    <th>Categoría</th>
                    <th>Stock</th>
                    <th>Precio</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((row) => (
                    <tr key={row.row}>
                      <td>{row.row}</td>
                      <td><strong>{row.productName}</strong>{!row.active && <small>Inactivo</small>}</td>
                      <td>{row.sku || row.barcode || '—'}</td>
                      <td>{row.category}</td>
                      <td>{row.stockQuantity}</td>
                      <td>{clp.format(row.grossPriceAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {preview.rowsTruncated && <p className="table-note">Vista de las primeras 100 filas.</p>}
          </section>
        </>
      )}
    </section>
  );
}

function Metric({ label, tone, value }: { label: string; tone?: string; value: number }) {
  return (
    <article className={`metric-card${tone ? ` metric-card--${tone}` : ''}`}>
      <span>{label}</span>
      <strong>{value.toLocaleString('es-CL')}</strong>
    </article>
  );
}

function formatBytes(bytes: number) {
  return `${(bytes / 1024).toLocaleString('es-CL', { maximumFractionDigits: 1 })} KB`;
}

function messageOf(reason: unknown) {
  return reason instanceof Error ? reason.message : 'No pudimos completar la operación.';
}
