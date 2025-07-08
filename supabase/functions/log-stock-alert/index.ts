
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

interface StockAlertRequest {
  product_id: string;
  product_name: string;
  supplier_name?: string;
  supplier_phone?: string;
  quantity_at_trigger: number;
  alert_type: 'out_of_stock' | 'low_stock' | 'expiration_soon';
  business_id: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: securityHeaders });
  }

  try {
    // Verify user is authenticated
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('No authorization header provided');
      throw new Error('No authorization header');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    // Verify JWT token and get user
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      console.error('Authentication failed:', authError);
      throw new Error('Unauthorized - Invalid token');
    }

    console.log('User authenticated:', user.email);

    // Parse request body
    const requestBody = await req.json();
    const { 
      product_id, 
      product_name, 
      supplier_name, 
      supplier_phone, 
      quantity_at_trigger, 
      alert_type, 
      business_id 
    }: StockAlertRequest = requestBody;

    if (!product_id || !product_name || !alert_type || !business_id || quantity_at_trigger === undefined) {
      throw new Error('Missing required fields');
    }

    console.log('Creating stock alert:', { product_name, alert_type, quantity_at_trigger });

    // Insert stock alert
    const { data, error } = await supabaseClient
      .from('stock_alerts')
      .insert({
        product_id,
        product_name,
        supplier_name: supplier_name || null,
        supplier_phone: supplier_phone || null,
        quantity_at_trigger,
        alert_type,
        business_id,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating stock alert:', error);
      throw new Error(`Failed to create stock alert: ${error.message}`);
    }

    console.log('Stock alert created successfully:', data.id);

    return new Response(JSON.stringify({ 
      success: true, 
      alert_id: data.id,
      message: 'התראת מלאי נוצרה בהצלחה'
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...securityHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in log-stock-alert function:", error);
    
    let status = 500;
    let errorMessage = 'שגיאה ביצירת התראת מלאי';
    
    if (error.message.includes('Unauthorized')) {
      status = 403;
      errorMessage = 'אין לך הרשאה לבצע פעולה זו';
    } else if (error.message.includes('Missing required fields')) {
      status = 400;
      errorMessage = 'חסרים שדות נדרשים';
    }
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage,
        details: error.message
      }),
      {
        status: status,
        headers: { "Content-Type": "application/json", ...securityHeaders },
      }
    );
  }
};

serve(handler);
