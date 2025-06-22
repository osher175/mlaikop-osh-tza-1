
import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Camera, Upload, X, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

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

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "שגיאה",
        description: "גודל הקובץ לא יכול לעלות על 5MB",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);

    try {
      // Create unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `products/${fileName}`;

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from('products')
        .upload(filePath, file, {
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
