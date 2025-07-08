
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface EmailRequest {
  to: string | string[];
  subject: string;
  html: string;
  isBulk?: boolean;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify user is authenticated and has admin role
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

    // Check if user has admin role using the database function
    const { data: userRole, error: roleError } = await supabaseClient.rpc('get_user_role', {
      user_uuid: user.id
    });

    if (roleError) {
      console.error('Error checking user role:', roleError);
      throw new Error('Error verifying user permissions');
    }

    if (userRole !== 'admin') {
      console.error('Access denied. User role:', userRole, 'Required: admin');
      throw new Error('Access denied. Admin role required.');
    }

    console.log('Admin role verified for user:', user.email);

    // Validate request body
    const requestBody = await req.json();
    const { to, subject, html, isBulk }: EmailRequest = requestBody;

    if (!to || !subject || !html) {
      throw new Error('Missing required fields: to, subject, or html');
    }

    // Rate limiting for bulk emails
    if (isBulk && Array.isArray(to) && to.length > 50) {
      throw new Error('Bulk email limit exceeded. Maximum 50 recipients per request.');
    }

    console.log('Sending email to:', Array.isArray(to) ? `${to.length} recipients` : to);
    console.log('Subject:', subject);
    console.log('Is bulk:', isBulk);

    // Send email using Resend
    const emailResponse = await resend.emails.send({
      from: "Mlaiko <noreply@mlaiko.com>",
      to: Array.isArray(to) ? to : [to],
      subject: subject,
      html: html,
    });

    if (emailResponse.error) {
      console.error("Email sending failed:", emailResponse.error);
      throw new Error(`Email sending failed: ${emailResponse.error.message}`);
    }

    console.log("Email sent successfully:", emailResponse.data?.id);

    // Log the email sending action for audit purposes
    try {
      await supabaseClient.from('emails').insert({
        email: Array.isArray(to) ? to.join(', ') : to,
        user_id: user.id,
      });
    } catch (logError) {
      console.error('Failed to log email action:', logError);
      // Don't fail the request if logging fails
    }

    return new Response(JSON.stringify({ 
      success: true, 
      id: emailResponse.data?.id,
      message: isBulk ? `נשלח לכל ${Array.isArray(to) ? to.length : 1} הכתובות בהצלחה` : 'המייל נשלח בהצלחה'
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-admin-email function:", error);
    
    // Return appropriate error status based on error type
    let status = 500;
    let errorMessage = 'שגיאה בשליחת המייל';
    
    if (error.message.includes('Unauthorized') || error.message.includes('Access denied')) {
      status = 403;
      errorMessage = 'אין לך הרשאה לבצע פעולה זו';
    } else if (error.message.includes('Missing required fields')) {
      status = 400;
      errorMessage = 'חסרים שדות נדרשים';
    } else if (error.message.includes('limit exceeded')) {
      status = 429;
      errorMessage = 'חרגת ממגבלת השליחה';
    }
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage,
        details: error.message
      }),
      {
        status: status,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
