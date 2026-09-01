import {
  Banknote,
  Barcode,
  CheckCircle2,
  CreditCard,
  LoaderCircle,
  Minus,
  Plus,
  Search,
  ShoppingCart,
  Trash2,
} from 'lucide-react';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { useAuth } from '../auth/use-auth';

interface Warehouse {
  id: string;
  name: string;
}

interface WarehousePage {
  data: Warehouse[];
}

interface CatalogItem {
  availableQuantity: number;
  barcode: string | null;
  category: { id: string; name: string } | null;
  priceAmount: number;
  productName: string;
  sku: string;
  variantId: string;
  variantName: string | null;
}

interface CatalogResponse {
  data: CatalogItem[];
  warehouse: Warehouse;
}

interface CartItem extends CatalogItem {
  quantity: number;
}

type PaymentMethod =
  | 'BANK_TRANSFER'
  | 'CASH'
  | 'CREDIT_CARD'
  | 'DEBIT_CARD';

interface PaymentDraft {
  amount: number;
  externalReference: string;
  id: string;
  method: PaymentMethod;
  provider: string;
  tenderedAmount: number;
}

interface SaleResponse {
  cashChangeAmount: number;
  idempotent: boolean;
  order: {
    id: string;
    number: string;
    totalAmount: string;
  };
}

const clp = new Intl.NumberFormat('es-CL', {
  currency: 'CLP',
  maximumFractionDigits: 0,
  style: 'currency',
});

const methodOptions: Array<{ icon: typeof Banknote; label: string; value: PaymentMethod }> = [
  { icon: Banknote, label: 'Efectivo', value: 'CASH' },
  { icon: CreditCard, label: 'Débito', value: 'DEBIT_CARD' },
  { icon: CreditCard, label: 'Crédito', value: 'CREDIT_CARD' },
  { icon: Banknote, label: 'Transferencia', value: 'BANK_TRANSFER' },
];

const providerOptions: Record<PaymentMethod, string[]> = {
  BANK_TRANSFER: ['BancoEstado', 'Otro banco'],
  CASH: ['Caja sucursal'],
  CREDIT_CARD: ['Transbank', 'Mercado Pago', 'BancoEstado'],
  DEBIT_CARD: ['Transbank', 'Mercado Pago', 'BancoEstado'],
};

export function PosPage() {
  const { request } = useAuth();
  const searchInput = useRef<HTMLInputElement>(null);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [warehouseId, setWarehouseId] = useState('');
  const [query, setQuery] = useState('');
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [payments, setPayments] = useState<PaymentDraft[]>([]);
  const [searching, setSearching] = useState(false);
  const [selling, setSelling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sale, setSale] = useState<SaleResponse | null>(null);
  const saleKey = useRef(crypto.randomUUID());

  const total = useMemo(
    () => cart.reduce((sum, item) => sum + item.priceAmount * item.quantity, 0),
    [cart],
  );
  const paid = payments.reduce((sum, payment) => sum + payment.amount, 0);
  const remaining = total - paid;

  useEffect(() => {
    let active = true;
    void request<WarehousePage>('/warehouses?page=1&limit=100&active=true')
      .then(({ data }) => {
        if (!active) return;
        setWarehouses(data);
        setWarehouseId(data[0]?.id ?? '');
      })
      .catch((reason: unknown) => {
        if (active) setError(messageOf(reason));
      });
    return () => {
      active = false;
    };
  }, [request]);

  useEffect(() => {
    if (!warehouseId) return;
    let active = true;
    const timeout = window.setTimeout(() => {
      setSearching(true);
      const params = new URLSearchParams({
        search: query.trim(),
        take: '24',
        warehouseId,
      });
      void request<CatalogResponse>(`/pos/catalog?${params}`)
        .then(({ data }) => {
          if (active) setCatalog(data);
        })
        .catch((reason: unknown) => {
          if (active) setError(messageOf(reason));
        })
        .finally(() => {
          if (active) setSearching(false);
        });
    }, 180);
    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [query, request, warehouseId]);

  function invalidateSale() {
    saleKey.current = crypto.randomUUID();
    setSale(null);
    setError(null);
  }

  function addToCart(item: CatalogItem) {
    invalidateSale();
    const found = cart.find((entry) => entry.variantId === item.variantId);
    const nextCart = found
      ? cart.map((entry) =>
          entry.variantId === item.variantId
            ? { ...entry, quantity: Math.min(entry.quantity + 1, entry.availableQuantity) }
            : entry,
        )
      : [...cart, { ...item, quantity: 1 }];
    setCart(nextCart);
    syncSinglePayment(nextCart);
    setQuery('');
    window.setTimeout(() => searchInput.current?.focus(), 0);
  }

  function changeQuantity(variantId: string, delta: number) {
    invalidateSale();
    const nextCart = cart
      .map((item) =>
        item.variantId === variantId
          ? {
              ...item,
              quantity: Math.min(
                item.availableQuantity,
                Math.max(0, item.quantity + delta),
              ),
            }
          : item,
      )
      .filter(({ quantity }) => quantity > 0);
    setCart(nextCart);
    syncSinglePayment(nextCart);
  }

  function syncSinglePayment(nextCart: CartItem[]) {
    if (nextCart.length === 0) {
      setPayments([]);
      return;
    }
    if (payments.length > 1) return;
    const nextTotal = nextCart.reduce(
      (sum, item) => sum + item.priceAmount * item.quantity,
      0,
    );
    const existing = payments[0];
    setPayments([
      {
        amount: nextTotal,
        externalReference: existing?.externalReference ?? '',
        id: existing?.id ?? crypto.randomUUID(),
        method: existing?.method ?? 'CASH',
        provider: existing?.provider ?? defaultProvider('CASH'),
        tenderedAmount: Math.max(existing?.tenderedAmount ?? nextTotal, nextTotal),
      },
    ]);
  }

  function scanFirst(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter' && catalog[0]) {
      event.preventDefault();
      addToCart(catalog[0]);
    }
  }

  function updatePayment(id: string, patch: Partial<PaymentDraft>) {
    invalidateSale();
    setPayments((current) =>
      current.map((payment) => {
        if (payment.id !== id) return payment;
        const next = { ...payment, ...patch };
        if (patch.method) {
          next.provider = defaultProvider(patch.method);
          next.tenderedAmount = next.amount;
        }
        return next;
      }),
    );
  }

  function addPayment() {
    if (remaining <= 0) return;
    invalidateSale();
    setPayments((current) => [
      ...current,
      {
        amount: remaining,
        externalReference: '',
        id: crypto.randomUUID(),
        method: 'DEBIT_CARD',
        provider: defaultProvider('DEBIT_CARD'),
        tenderedAmount: remaining,
      },
    ]);
  }

  async function completeSale() {
    if (!warehouseId || cart.length === 0 || paid !== total) return;
    for (const payment of payments) {
      if (payment.amount < 1) {
        setError('Cada pago debe tener un monto mayor que cero.');
        return;
      }
      if (payment.method === 'CASH' && payment.tenderedAmount < payment.amount) {
        setError('El efectivo recibido no puede ser menor al monto aplicado.');
        return;
      }
    }
    setSelling(true);
    setError(null);
    try {
      const response = await request<SaleResponse>('/pos/sales', {
        body: JSON.stringify({
          idempotencyKey: saleKey.current,
          items: cart.map(({ quantity, variantId }) => ({ quantity, variantId })),
          payments: payments.map((payment) => ({
            amount: payment.amount,
            ...(payment.externalReference.trim()
              ? { externalReference: payment.externalReference.trim() }
              : {}),
            method: payment.method,
            provider: payment.provider,
            ...(payment.method === 'CASH'
              ? { tenderedAmount: payment.tenderedAmount }
              : {}),
          })),
          warehouseId,
        }),
        method: 'POST',
      });
      setSale(response);
      setCart([]);
      setPayments([]);
      saleKey.current = crypto.randomUUID();
      setQuery('');
      window.setTimeout(() => searchInput.current?.focus(), 0);
    } catch (reason) {
      setError(messageOf(reason));
    } finally {
      setSelling(false);
    }
  }

  return (
    <section className="operation-page pos-page">
      <header className="page-heading page-heading--top">
        <div>
          <p className="eyebrow">Sucursal · Punto de venta</p>
          <h1>Nueva venta</h1>
          <p>Escanea productos, combina medios de pago y descuenta el stock en el momento.</p>
        </div>
        <label className="compact-field warehouse-picker">
          <span>Bodega operativa</span>
          <select onChange={(event) => setWarehouseId(event.target.value)} value={warehouseId}>
            {warehouses.map((warehouse) => (
              <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>
            ))}
          </select>
        </label>
      </header>

      {error && <div className="inline-alert inline-alert--error">{error}</div>}
      {sale && (
        <article className="surface-card sale-success" role="status">
          <CheckCircle2 size={29} />
          <div>
            <p className="eyebrow">Venta completada</p>
            <h2>{sale.order.number}</h2>
            <p>
              Total {clp.format(Number(sale.order.totalAmount))}
              {sale.cashChangeAmount > 0 && ` · Vuelto ${clp.format(sale.cashChangeAmount)}`}
            </p>
            <small>El stock ya fue descontado. La emisión automática del DTE en RealBase queda preparada para el siguiente corte.</small>
          </div>
        </article>
      )}

      <div className="pos-layout">
        <section className="pos-catalog">
          <div className="search-box">
            <Search size={20} />
            <input
              autoFocus
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={scanFirst}
              placeholder="Escanea el código o busca por nombre y SKU"
              ref={searchInput}
              value={query}
            />
            {searching ? <LoaderCircle className="spin" size={18} /> : <Barcode size={20} />}
          </div>
          <div className="catalog-grid">
            {catalog.map((item) => (
              <button className="product-tile" key={item.variantId} onClick={() => addToCart(item)} type="button">
                <span className="product-tile-category">{item.category?.name ?? 'Sin categoría'}</span>
                <strong>{item.productName}</strong>
                {item.variantName && <small>{item.variantName}</small>}
                <span className="product-tile-meta">
                  <b>{clp.format(item.priceAmount)}</b>
                  <small>{item.availableQuantity} disponibles</small>
                </span>
                <span className="product-tile-code">{item.barcode ?? item.sku}</span>
              </button>
            ))}
            {!searching && catalog.length === 0 && (
              <div className="empty-state">
                <Barcode size={30} />
                <strong>No encontramos productos con stock</strong>
                <span>Prueba otro código o revisa la bodega seleccionada.</span>
              </div>
            )}
          </div>
        </section>

        <aside className="surface-card cart-panel">
          <div className="cart-heading">
            <span><ShoppingCart size={20} /><strong>Venta actual</strong></span>
            <small>{cart.reduce((sum, item) => sum + item.quantity, 0)} unidades</small>
          </div>
          <div className="cart-items">
            {cart.length === 0 && (
              <div className="empty-cart">
                <ShoppingCart size={27} />
                <span>Agrega o escanea el primer producto.</span>
              </div>
            )}
            {cart.map((item) => (
              <div className="cart-item" key={item.variantId}>
                <div>
                  <strong>{item.productName}</strong>
                  <small>{clp.format(item.priceAmount)} c/u</small>
                </div>
                <div className="quantity-control">
                  <button aria-label={`Quitar ${item.productName}`} onClick={() => changeQuantity(item.variantId, -1)} type="button"><Minus size={14} /></button>
                  <span>{item.quantity}</span>
                  <button aria-label={`Agregar ${item.productName}`} disabled={item.quantity >= item.availableQuantity} onClick={() => changeQuantity(item.variantId, 1)} type="button"><Plus size={14} /></button>
                </div>
                <strong>{clp.format(item.priceAmount * item.quantity)}</strong>
                <button aria-label={`Eliminar ${item.productName}`} className="remove-button" onClick={() => changeQuantity(item.variantId, -item.quantity)} type="button"><Trash2 size={16} /></button>
              </div>
            ))}
          </div>

          {cart.length > 0 && (
            <>
              <div className="cart-total"><span>Total</span><strong>{clp.format(total)}</strong></div>
              <section className="payments-section">
                <div className="section-heading section-heading--compact">
                  <div><p className="eyebrow">Medios de pago</p><h2>Pago de la venta</h2></div>
                  {remaining > 0 && payments.length < 10 && (
                    <button className="text-button" onClick={addPayment} type="button"><Plus size={15} /> Pago mixto</button>
                  )}
                </div>
                {payments.map((payment, index) => (
                  <div className="payment-card" key={payment.id}>
                    <div className="payment-number">{index + 1}</div>
                    <label className="compact-field">
                      <span>Medio</span>
                      <select value={payment.method} onChange={(event) => updatePayment(payment.id, { method: event.target.value as PaymentMethod })}>
                        {methodOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                      </select>
                    </label>
                    <label className="compact-field">
                      <span>Operador</span>
                      <select value={payment.provider} onChange={(event) => updatePayment(payment.id, { provider: event.target.value })}>
                        {providerOptions[payment.method].map((provider) => <option key={provider} value={provider}>{provider}</option>)}
                      </select>
                    </label>
                    <label className="compact-field">
                      <span>Monto</span>
                      <input min="1" onChange={(event) => updatePayment(payment.id, { amount: integerValue(event.target.value) })} step="1" type="number" value={payment.amount} />
                    </label>
                    {payment.method === 'CASH' ? (
                      <label className="compact-field">
                        <span>Recibido</span>
                        <input min={payment.amount} onChange={(event) => updatePayment(payment.id, { tenderedAmount: integerValue(event.target.value) })} step="1" type="number" value={payment.tenderedAmount} />
                      </label>
                    ) : (
                      <label className="compact-field">
                        <span>Referencia (opcional)</span>
                        <input onChange={(event) => updatePayment(payment.id, { externalReference: event.target.value })} placeholder="N.º operación" value={payment.externalReference} />
                      </label>
                    )}
                    {payments.length > 1 && (
                      <button aria-label="Eliminar pago" className="remove-button payment-remove" onClick={() => { invalidateSale(); setPayments((current) => current.filter(({ id }) => id !== payment.id)); }} type="button"><Trash2 size={16} /></button>
                    )}
                  </div>
                ))}
                <div className={`payment-balance${remaining === 0 ? ' payment-balance--ready' : ''}`}>
                  <span>{remaining >= 0 ? 'Falta asignar' : 'Exceso asignado'}</span>
                  <strong>{clp.format(Math.abs(remaining))}</strong>
                </div>
              </section>
              <button className="primary-button checkout-button" disabled={selling || paid !== total || total <= 0} onClick={() => void completeSale()} type="button">
                {selling ? <LoaderCircle className="spin" size={19} /> : <CheckCircle2 size={19} />}
                Confirmar venta · {clp.format(total)}
              </button>
            </>
          )}
        </aside>
      </div>
    </section>
  );
}

function integerValue(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : 0;
}

function defaultProvider(method: PaymentMethod) {
  return providerOptions[method][0] ?? 'Otro';
}

function messageOf(reason: unknown) {
  return reason instanceof Error ? reason.message : 'No pudimos completar la operación.';
}
