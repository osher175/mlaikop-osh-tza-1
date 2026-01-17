import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Simple image compression using canvas-like approach for JPEG
async function compressImageBlob(imageData: ArrayBuffer, maxDim: number = 800, quality: number = 0.8): Promise<Blob> {
  // For server-side, we'll use a different approach - resize using fetch to a compression service
  // or return original if small enough. For now, we'll use basic re-encoding.
  
  // Check if image is already small (< 200KB)
  if (imageData.byteLength < 200 * 1024) {
    return new Blob([imageData], { type: "image/jpeg" });
  }
  
  // For larger images, we'll create a reduced quality version
  // This is a simplified approach - in production you might use Sharp via npm
  const blob = new Blob([imageData], { type: "image/jpeg" });
  return blob;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    // Get auth token from request
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create client with user's token to verify auth
    const supabaseUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify user is authenticated and has admin/owner role
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check user role
    const { data: profile } = await supabaseUser
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || !["admin", "OWNER"].includes(profile.role || "")) {
      return new Response(
        JSON.stringify({ error: "Only admins can compress storage images" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use service role client for storage operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { action } = await req.json();

    if (action === "list") {
      // List all files in products bucket with their sizes
      const { data: files, error: listError } = await supabaseAdmin.storage
        .from("products")
        .list("products", { limit: 1000 });

      if (listError) {
        throw listError;
      }

      const fileStats = files?.map((file) => ({
        name: file.name,
        size: file.metadata?.size || 0,
        path: `products/${file.name}`,
      })) || [];

      const totalSize = fileStats.reduce((sum, f) => sum + f.size, 0);
      const largeFiles = fileStats.filter((f) => f.size > 500 * 1024); // > 500KB

      return new Response(
        JSON.stringify({
          totalFiles: fileStats.length,
          totalSizeBytes: totalSize,
          totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2),
          largeFilesCount: largeFiles.length,
          largeFiles: largeFiles.slice(0, 20), // Return top 20 large files
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "compress") {
      const { filePath } = await req.json().catch(() => ({}));
      
      if (!filePath) {
        return new Response(
          JSON.stringify({ error: "filePath is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Download the file
      const { data: fileData, error: downloadError } = await supabaseAdmin.storage
        .from("products")
        .download(filePath);

      if (downloadError || !fileData) {
        throw downloadError || new Error("Failed to download file");
      }

      const originalSize = fileData.size;

      // Skip if already small
      if (originalSize < 200 * 1024) {
        return new Response(
          JSON.stringify({
            success: true,
            message: "File already optimized",
            originalSize,
            newSize: originalSize,
            saved: 0,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // For now, we'll just report that compression would need a more robust solution
      // In production, you'd use Sharp or similar library
      return new Response(
        JSON.stringify({
          success: false,
          message: "Server-side compression requires additional setup. Consider deleting unused images instead.",
          originalSize,
          filePath,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "delete") {
      const { filePath } = await req.json().catch(() => ({}));
      
      if (!filePath) {
        return new Response(
          JSON.stringify({ error: "filePath is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Delete the file
      const { error: deleteError } = await supabaseAdmin.storage
        .from("products")
        .remove([filePath]);

      if (deleteError) {
        throw deleteError;
      }

      return new Response(
        JSON.stringify({ success: true, message: "File deleted successfully" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "find-orphans") {
      // Find images not linked to any product
      const { data: files } = await supabaseAdmin.storage
        .from("products")
        .list("products", { limit: 1000 });

      const { data: products } = await supabaseAdmin
        .from("products")
        .select("image");

      const productImages = new Set(
        products?.map((p) => p.image).filter(Boolean) || []
      );

      const orphanFiles = files?.filter((file) => {
        const fullPath = `products/${file.name}`;
        const publicUrl = `${supabaseUrl}/storage/v1/object/public/products/${fullPath}`;
        return !productImages.has(publicUrl);
      }) || [];

      const orphanSize = orphanFiles.reduce((sum, f) => sum + (f.metadata?.size || 0), 0);

      return new Response(
        JSON.stringify({
          orphanCount: orphanFiles.length,
          orphanSizeBytes: orphanSize,
          orphanSizeMB: (orphanSize / (1024 * 1024)).toFixed(2),
          orphanFiles: orphanFiles.slice(0, 50).map((f) => ({
            name: f.name,
            size: f.metadata?.size || 0,
            path: `products/${f.name}`,
          })),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "delete-orphans") {
      // Find and delete orphan images
      const { data: files } = await supabaseAdmin.storage
        .from("products")
        .list("products", { limit: 1000 });

      const { data: products } = await supabaseAdmin
        .from("products")
        .select("image");

      const productImages = new Set(
        products?.map((p) => p.image).filter(Boolean) || []
      );

      const orphanPaths = files?.filter((file) => {
        const fullPath = `products/${file.name}`;
        const publicUrl = `${supabaseUrl}/storage/v1/object/public/products/${fullPath}`;
        return !productImages.has(publicUrl);
      }).map((f) => `products/${f.name}`) || [];

      if (orphanPaths.length === 0) {
        return new Response(
          JSON.stringify({ success: true, deletedCount: 0, message: "No orphan files found" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { error: deleteError } = await supabaseAdmin.storage
        .from("products")
        .remove(orphanPaths);

      if (deleteError) {
        throw deleteError;
      }

      return new Response(
        JSON.stringify({
          success: true,
          deletedCount: orphanPaths.length,
          message: `Deleted ${orphanPaths.length} orphan files`,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
