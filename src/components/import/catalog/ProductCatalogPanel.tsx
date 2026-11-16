import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/lib/formatCurrency';

interface Props {
  businessId: string;
  productIds: string[];
}

type CatalogRow = Record<string, unknown>;

/**
 * Read-only view of the existing product and the I2 catalog tables.
 * Those tables accept SELECT only. Nothing here writes stock, cost, or a new product.
 */
export const ProductCatalogPanel: React.FC<Props> = ({ businessId, productIds }) => {
  const ids = [...new Set(productIds.filter(Boolean))];
  const catalog = useQuery({
    queryKey: ['import-product-catalog', businessId, ids],
    enabled: ids.length > 0,
    queryFn: () => loadCatalog(businessId, ids),
  });

  if (ids.length === 0) {
    return (
      <section className="rounded-2xl border p-4 text-sm text-muted-foreground" dir="rtl">
        אין פריטים מקושרים למוצר קיים. הקישור נעשה משורת ההזמנה, אל מוצר שכבר קיים במלאי או דרך יצירת המוצר הקיימת.
      </section>
    );
  }

  if (catalog.isLoading) {
    return <section className="rounded-2xl border p-4 text-sm" dir="rtl">טוען מפרט מוצרים…</section>;
  }

  if (catalog.isError || catalog.data?.unavailable) {
    return (
      <section className="rounded-2xl border p-4 text-sm" dir="rtl">
        קריאת קטלוג היבוא אינה זמינה כרגע. מוצרי המלאי הקיימים לא שונו.
      </section>
    );
  }

  const data = catalog.data!;
  return (
    <section className="rounded-2xl border p-4 space-y-3" dir="rtl">
      <div>
        <h3 className="font-semibold">מפרט מוצרים מקושרים</h3>
        <p className="text-xs text-muted-foreground">
          קריאה בלבד. עריכת מפרט, מק״ט ספק, מחירון ומדיה אינה זמינה בשלב זה, כי אין נתיב כתיבה מורשה.
        </p>
      </div>
      <div className="space-y-3">
        {ids.map((id) => {
          const product = data.products.find((row) => row.id === id);
          const spec = data.specs.find((row) => row.product_id === id);
          const skus = data.skus.filter((row) => row.product_id === id);
          const prices = data.prices.filter((row) => row.product_id === id);
          const media = data.media.filter((row) => row.product_id === id);
          const image = typeof product?.image === 'string' ? product.image : '';
          return (
            <article key={id} className="rounded-xl border p-3 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{product?.name || 'מוצר מקושר'}</p>
                  <p className="text-xs text-muted-foreground">מזהה קיים במלאי</p>
                </div>
                {image.startsWith('http') && (
                  <img src={image} alt="" className="h-14 w-14 rounded-lg object-cover border" />
                )}
              </div>
              <p className="text-sm">
                מידה: {specLine(spec) || 'לא הוזן מפרט צמיג'}
              </p>
              <p className="text-sm">
                מק״ט ספק: {skus.length === 0 ? 'לא נשמר' : skus.map((row) => String(row.supplier_sku)).join(', ')}
              </p>
              <p className="text-sm">
                מחירון: {prices.length === 0 ? 'לא נשמר' : prices.map(priceLine).join(' · ')}
              </p>
              <p className="text-sm">
                מדיה נוספת: {media.length === 0 ? 'אין' : `${media.length} נתיבים שמורים`}
              </p>
            </article>
          );
        })}
      </div>
    </section>
  );
};

function specLine(spec: CatalogRow | undefined): string {
  if (!spec) return '';
  const parts = [spec.width_mm, spec.aspect_ratio, spec.rim_inch].filter((part) => part != null);
  const size = parts.length === 3 ? `${parts[0]}/${parts[1]}R${parts[2]}` : '';
  const rating = [spec.load_index, spec.speed_rating].filter(Boolean).join('');
  return [spec.model_name, size, rating].filter(Boolean).join(' · ');
}

function priceLine(row: CatalogRow): string {
  const channel = row.channel === 'wholesale' ? 'סיטונאי' : row.channel === 'retail' ? 'קמעונאי' : String(row.channel ?? '');
  return `${channel} ${formatCurrency(Number(row.amount_ils ?? 0))}`;
}

async function loadCatalog(businessId: string, ids: string[]) {
  const client = supabase as unknown as { from: (table: string) => any };
  const [products, specs, skus, prices, media] = await Promise.all([
    supabase.from('products').select('id, name, image').in('id', ids).eq('business_id', businessId),
    client.from('product_tire_specs').select('product_id, model_name, width_mm, aspect_ratio, rim_inch, load_index, speed_rating').in('product_id', ids).eq('business_id', businessId),
    client.from('product_supplier_skus').select('product_id, supplier_sku').in('product_id', ids).eq('business_id', businessId),
    client.from('product_price_lists').select('product_id, channel, amount_ils').in('product_id', ids).eq('business_id', businessId),
    client.from('product_media_references').select('product_id, storage_path').in('product_id', ids).eq('business_id', businessId),
  ]);
  if (products.error) throw products.error;
  const catalogError = [specs, skus, prices, media].find((result) => result.error)?.error;
  if (catalogError) return { unavailable: true, products: [], specs: [], skus: [], prices: [], media: [] };
  return {
    unavailable: false,
    products: products.data ?? [],
    specs: (specs.data ?? []) as CatalogRow[],
    skus: (skus.data ?? []) as CatalogRow[],
    prices: (prices.data ?? []) as CatalogRow[],
    media: (media.data ?? []) as CatalogRow[],
  };
}
