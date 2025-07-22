
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

console.log("Clever Service Edge Function started");

serve(async (req) => {
  console.log(`Received ${req.method} request`);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log("Handling CORS preflight request");
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse the request body
    const requestBody = await req.json();
    console.log("Received webhook data:", JSON.stringify(requestBody, null, 2));

    // Validate required fields
    const { product_id, product_name, quantity, supplier_id } = requestBody;
    
    if (!product_id || !product_name || quantity === undefined) {
      console.error("Missing required fields in webhook payload");
      return new Response(
        JSON.stringify({ error: "Missing required fields: product_id, product_name, quantity" }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Log the out-of-stock event
    console.log(`Product out of stock alert: ${product_name} (ID: ${product_id})`);
    console.log(`Quantity: ${quantity}, Supplier ID: ${supplier_id || 'None'}`);

    // Here you can add logic to send to external webhook (n8n) if needed
    // For now, we'll just log and respond successfully
    
    const response = {
      status: "success",
      message: "Out of stock webhook received successfully",
      data: {
        product_id,
        product_name,
        quantity,
        supplier_id,
        timestamp: new Date().toISOString()
      }
    };

    console.log("Sending response:", JSON.stringify(response, null, 2));

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in clever-service function:', error);
    
    return new Response(
      JSON.stringify({ 
        error: "Internal server error", 
        details: error.message 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
