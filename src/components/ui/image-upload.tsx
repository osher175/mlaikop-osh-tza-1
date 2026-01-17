
import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Camera, Upload, X, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

// Compress image using Canvas API - reduces size by 15-20x
async function compressImage(file: File): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    
    img.onload = () => {
      URL.revokeObjectURL(url);
      
      const maxDim = 800;
      let { width, height } = img;
      
      // Calculate new dimensions maintaining aspect ratio
      if (width > height && width > maxDim) {
        height = Math.round((height * maxDim) / width);
        width = maxDim;
      } else if (height > maxDim) {
        width = Math.round((width * maxDim) / height);
        height = maxDim;
      }
      
      // Draw to canvas and compress
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }
      
      ctx.drawImage(img, 0, 0, width, height);
      
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Could not create blob'));
            return;
          }
          
          const compressed = new File(
            [blob], 
            file.name.replace(/\.[^.]+$/, '.jpg'),
            { type: 'image/jpeg' }
          );
          
          console.log(`Image compressed: ${(file.size / 1024).toFixed(0)}KB → ${(compressed.size / 1024).toFixed(0)}KB`);
          resolve(compressed);
        },
        'image/jpeg',
        0.8 // 80% quality
      );
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not load image'));
    };
    
    img.src = url;
  });
}

interface ImageUploadProps {
  currentImageUrl?: string;
  onImageUpload: (imageUrl: string) => void;
  onImageRemove?: () => void;
  className?: string;
}

export const ImageUpload: React.FC<ImageUploadProps> = ({
  currentImageUrl,
  onImageUpload,
  onImageRemove,
  className = '',
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentImageUrl || null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "שגיאה",
        description: "אנא בחר קובץ תמונה בלבד",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 10MB before compression)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "שגיאה",
        description: "גודל הקובץ לא יכול לעלות על 10MB",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);

    try {
      // Compress image before upload
      const compressedFile = await compressImage(file);
      
      // Create unique filename with .jpg extension
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.jpg`;
      const filePath = `products/${fileName}`;

      // Upload compressed image to Supabase Storage
      const { data, error } = await supabase.storage
        .from('products')
        .upload(filePath, compressedFile, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) throw error;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('products')
        .getPublicUrl(filePath);

      setPreviewUrl(publicUrl);
      onImageUpload(publicUrl);

      toast({
        title: "התמונה הועלתה בהצלחה",
        description: "התמונה נשמרה במערכת",
      });

    } catch (error) {
      console.error('Error uploading image:', error);
      toast({
        title: "שגיאה בהעלאת התמונה",
        description: "אנא נסה שוב",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveImage = () => {
    setPreviewUrl(null);
    if (onImageRemove) {
      onImageRemove();
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
        disabled={isUploading}
      />

      {previewUrl ? (
        <div className="relative">
          <div className="w-full h-48 bg-gray-100 rounded-lg overflow-hidden">
            <img
              src={previewUrl}
              alt="תצוגה מקדימה"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex gap-2 mt-2">
            <Button
              type="button"
              variant="outline"
              onClick={triggerFileInput}
              disabled={isUploading}
              className="flex-1"
            >
              {isUploading ? (
                <Loader2 className="w-4 h-4 animate-spin ml-2" />
              ) : (
                <Camera className="w-4 h-4 ml-2" />
              )}
              החלף תמונה
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleRemoveImage}
              disabled={isUploading}
              className="px-3"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      ) : (
        <div className="w-full h-48 bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center">
          <div className="text-center">
            {isUploading ? (
              <Loader2 className="w-8 h-8 animate-spin text-gray-400 mx-auto mb-2" />
            ) : (
              <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            )}
            <p className="text-sm text-gray-600 mb-4">
              {isUploading ? 'מעלה תמונה...' : 'לחץ להעלאת תמונה'}
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={triggerFileInput}
              disabled={isUploading}
            >
              <Camera className="w-4 h-4 ml-2" />
              בחר תמונה
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
