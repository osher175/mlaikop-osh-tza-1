
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Security Headers - הגנת דפדפן
const securityHeaders = {
  "Content-Security-Policy": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' https:",
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "X-XSS-Protection": "1; mode=block",
  ...corsHeaders,
};

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: securityHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    console.log('Starting expiring products check...');

    // Get all expiring products (7 days or less)
    const { data: expiringProducts, error } = await supabaseClient
      .rpc('get_expiring_products', { days_ahead: 7 });

    if (error) {
      console.error('Error fetching expiring products:', error);
      throw new Error(`Failed to fetch expiring products: ${error.message}`);
    }

    console.log(`Found ${expiringProducts?.length || 0} expiring products`);

    let alertsCreated = 0;
    let skippedBusinesses = 0;
    const billingCache = new Map<string, boolean>(); // business_id -> isActive

    if (expiringProducts && expiringProducts.length > 0) {
      // Create alerts for products that don't already have recent alerts
      for (const product of expiringProducts) {
        // Per-business billing skip (cached). Do NOT fail the whole run on one inactive business.
        let isActive = billingCache.get(product.business_id);
        if (isActive === undefined) {
          // Kill-switch: bypass when BILLING_LOCK_ENABLED != 'true'.
          const billingError = Deno.env.get('BILLING_LOCK_ENABLED') === 'true'
            ? (await supabaseClient.rpc('require_active_business', { p_business_id: product.business_id })).error
            : null;
          isActive = !billingError;
          billingCache.set(product.business_id, isActive);
          if (!isActive) {
            console.log(`Skipping business ${product.business_id} - billing inactive: ${billingError?.message}`);
            try {
              await supabaseClient.from('billing_events').insert({
                business_id: product.business_id,
                event_type: 'billing_gate_blocked_action',
                source: 'check-expiring-products',
                metadata: { action: 'expiration_alert', error_message: billingError?.message },
              });
            } catch (_) { /* noop */ }
          }
        }
        if (!isActive) { skippedBusinesses++; continue; }

        // Check if alert already exists in the last 24 hours
        const { data: existingAlert } = await supabaseClient
          .from('stock_alerts')
          .select('id')
          .eq('product_id', product.product_id)
          .eq('alert_type', 'expiration_soon')
          .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
          .single();

        if (!existingAlert) {
          // Create new expiration alert
          const { error: insertError } = await supabaseClient
            .from('stock_alerts')
            .insert({
              product_id: product.product_id,
              product_name: product.product_name,
              supplier_name: product.supplier_name,
              quantity_at_trigger: product.quantity,
              alert_type: 'expiration_soon',
              business_id: product.business_id,
            });

          if (insertError) {
            console.error('Error creating expiration alert:', insertError);
          } else {
            alertsCreated++;
            console.log(`Created expiration alert for product: ${product.product_name}`);
          }
        }
      }
    }

    console.log(`Done. Alerts: ${alertsCreated}. Skipped (inactive billing): ${skippedBusinesses}.`);

    return new Response(JSON.stringify({ 
      success: true, 
      expiring_products_count: expiringProducts?.length || 0,
      alerts_created: alertsCreated,
      message: `נבדקו מוצרים עם תוקף קרוב. נוצרו ${alertsCreated} התראות חדשות`
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...securityHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in check-expiring-products function:", error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'שגיאה בבדיקת מוצרים עם תוקף קרוב',
        details: error.message
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...securityHeaders },
      }
    );
  }
};

serve(handler);
