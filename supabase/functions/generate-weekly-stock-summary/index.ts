
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

    console.log('Starting weekly stock summary generation...');

    // Get all businesses
    const { data: businesses, error: businessesError } = await supabaseClient
      .from('businesses')
      .select('id, name, owner_id');

    if (businessesError) {
      console.error('Error fetching businesses:', businessesError);
      throw new Error(`Failed to fetch businesses: ${businessesError.message}`);
    }

    console.log(`Found ${businesses?.length || 0} businesses`);

    const summaries = [];

    if (businesses && businesses.length > 0) {
      for (const business of businesses) {
        try {
          // Generate summary for each business
          const { data: summary, error: summaryError } = await supabaseClient
            .rpc('generate_weekly_stock_summary', { target_business_id: business.id });

          if (summaryError) {
            console.error(`Error generating summary for business ${business.name}:`, summaryError);
            continue;
          }

          if (summary) {
            summaries.push({
              business_name: business.name,
              business_id: business.id,
              summary: summary
            });

            console.log(`Generated summary for business: ${business.name}`);
            console.log(`- Total products: ${summary.total_products}`);
            console.log(`- Out of stock: ${summary.out_of_stock_count}`);
            console.log(`- Low stock: ${summary.low_stock_count}`);
            console.log(`- Expiring soon: ${summary.expiring_soon_count}`);
            console.log(`- Stale products: ${summary.stale_products_count}`);
          }
        } catch (businessError) {
          console.error(`Error processing business ${business.name}:`, businessError);
        }
      }
    }

    console.log(`Weekly stock summary generation completed. Generated ${summaries.length} summaries.`);

    return new Response(JSON.stringify({ 
      success: true, 
      businesses_processed: businesses?.length || 0,
      summaries_generated: summaries.length,
      summaries: summaries,
      message: `דו"ח שבועי הופק עבור ${summaries.length} עסקים`
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...securityHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in generate-weekly-stock-summary function:", error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'שגיאה בהפקת דו"ח שבועי',
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
