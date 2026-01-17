import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Compress JPEG using Canvas API simulation via Deno
async function compressImage(
  imageData: Uint8Array,
  targetWidth: number = 800,
  quality: number = 0.75
): Promise<{ data: Uint8Array; originalSize: number; newSize: number }> {
  const originalSize = imageData.length;

  // For images already smaller than 200KB, skip compression
  if (originalSize < 200 * 1024) {
    return { data: imageData, originalSize, newSize: originalSize };
  }

  try {
    // Use ImageScript for Deno image processing
    const ImageScript = await import("https://deno.land/x/imagescript@1.3.0/mod.ts");
    
    // Decode image
    let image;
    try {
      image = await ImageScript.decode(imageData);
    } catch (e) {
      console.log("Failed to decode image, returning original:", e.message);
      return { data: imageData, originalSize, newSize: originalSize };
    }

    // Calculate new dimensions maintaining aspect ratio
    const aspectRatio = image.height / image.width;
    let newWidth = image.width;
    let newHeight = image.height;

    if (image.width > targetWidth) {
      newWidth = targetWidth;
      newHeight = Math.round(targetWidth * aspectRatio);
    }

    // Resize if needed
    if (newWidth !== image.width) {
      image.resize(newWidth, newHeight);
    }

    // Encode as JPEG with quality
    const qualityPercent = Math.round(quality * 100);
    const encoded = await image.encodeJPEG(qualityPercent);
    
    console.log(`Compressed: ${(originalSize / 1024).toFixed(0)}KB → ${(encoded.length / 1024).toFixed(0)}KB`);
    
    return { 
      data: encoded, 
      originalSize, 
      newSize: encoded.length 
    };
  } catch (error) {
    console.error("Compression error:", error);
    return { data: imageData, originalSize, newSize: originalSize };
  }
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

    // Check user role from user_roles table (not profiles)
    const { data: userRoleData } = await supabaseUser
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    const userRole = userRoleData?.role || '';
    console.log(`User ${user.id} role: ${userRole}`);

    if (!["admin", "OWNER"].includes(userRole)) {
      return new Response(
        JSON.stringify({ error: "Only admins can compress storage images", userRole }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use service role client for storage operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { action } = body;

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

    if (action === "compress-single") {
      const { filePath } = body;
      
      if (!filePath) {
        return new Response(
          JSON.stringify({ error: "filePath is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`Compressing: ${filePath}`);

      // Download the file
      const { data: fileData, error: downloadError } = await supabaseAdmin.storage
        .from("products")
        .download(filePath);

      if (downloadError || !fileData) {
        throw downloadError || new Error("Failed to download file");
      }

      const arrayBuffer = await fileData.arrayBuffer();
      const imageData = new Uint8Array(arrayBuffer);

      // Compress the image
      const { data: compressedData, originalSize, newSize } = await compressImage(imageData);

      // Only re-upload if we achieved compression
      if (newSize < originalSize * 0.9) {
        // Delete old file
        await supabaseAdmin.storage.from("products").remove([filePath]);

        // Upload compressed version with same name
        const newFileName = filePath.replace(/\.[^.]+$/, '.jpg');
        const { error: uploadError } = await supabaseAdmin.storage
          .from("products")
          .upload(newFileName, compressedData, {
            contentType: "image/jpeg",
            upsert: true,
          });

        if (uploadError) {
          throw uploadError;
        }

        // Update product reference if file name changed
        if (newFileName !== filePath) {
          const oldUrl = `${supabaseUrl}/storage/v1/object/public/products/${filePath}`;
          const newUrl = `${supabaseUrl}/storage/v1/object/public/products/${newFileName}`;
          
          await supabaseAdmin
            .from("products")
            .update({ image: newUrl })
            .eq("image", oldUrl);
        }

        return new Response(
          JSON.stringify({
            success: true,
            originalSize,
            newSize,
            savedBytes: originalSize - newSize,
            savedMB: ((originalSize - newSize) / (1024 * 1024)).toFixed(2),
            compressionRatio: ((1 - newSize / originalSize) * 100).toFixed(1),
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } else {
        return new Response(
          JSON.stringify({
            success: true,
            message: "Image already optimized",
            originalSize,
            newSize,
            savedBytes: 0,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    if (action === "compress-all") {
      // Get list of large files to compress
      const { data: files, error: listError } = await supabaseAdmin.storage
        .from("products")
        .list("products", { limit: 1000 });

      if (listError) {
        throw listError;
      }

      const largeFiles = files?.filter((f) => (f.metadata?.size || 0) > 200 * 1024) || [];
      
      console.log(`Found ${largeFiles.length} files to compress`);

      let totalSaved = 0;
      let processed = 0;
      let errors = 0;
      const results: Array<{ file: string; saved: number; error?: string }> = [];

      for (const file of largeFiles) {
        try {
          const filePath = `products/${file.name}`;
          console.log(`Processing ${processed + 1}/${largeFiles.length}: ${file.name}`);

          // Download
          const { data: fileData, error: downloadError } = await supabaseAdmin.storage
            .from("products")
            .download(filePath);

          if (downloadError || !fileData) {
            errors++;
            results.push({ file: file.name, saved: 0, error: downloadError?.message || "Download failed" });
            continue;
          }

          const arrayBuffer = await fileData.arrayBuffer();
          const imageData = new Uint8Array(arrayBuffer);

          // Compress
          const { data: compressedData, originalSize, newSize } = await compressImage(imageData);

          // Only re-upload if we achieved significant compression
          if (newSize < originalSize * 0.9) {
            // Delete old file
            await supabaseAdmin.storage.from("products").remove([filePath]);

            // Upload compressed version
            const newFileName = filePath.replace(/\.[^.]+$/, '.jpg');
            const { error: uploadError } = await supabaseAdmin.storage
              .from("products")
              .upload(newFileName, compressedData, {
                contentType: "image/jpeg",
                upsert: true,
              });

            if (uploadError) {
              errors++;
              results.push({ file: file.name, saved: 0, error: uploadError.message });
              continue;
            }

            // Update product reference if file name changed
            if (newFileName !== filePath) {
              const oldUrl = `${supabaseUrl}/storage/v1/object/public/products/${filePath}`;
              const newUrl = `${supabaseUrl}/storage/v1/object/public/products/${newFileName}`;
              
              await supabaseAdmin
                .from("products")
                .update({ image: newUrl })
                .eq("image", oldUrl);
            }

            const saved = originalSize - newSize;
            totalSaved += saved;
            results.push({ file: file.name, saved });
          } else {
            results.push({ file: file.name, saved: 0 });
          }

          processed++;
        } catch (e) {
          console.error(`Error processing ${file.name}:`, e);
          errors++;
          results.push({ file: file.name, saved: 0, error: e.message });
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          totalFiles: largeFiles.length,
          processed,
          errors,
          totalSavedBytes: totalSaved,
          totalSavedMB: (totalSaved / (1024 * 1024)).toFixed(2),
          results: results.slice(0, 50), // Return first 50 results
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "delete") {
      const { filePath } = body;
      
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
