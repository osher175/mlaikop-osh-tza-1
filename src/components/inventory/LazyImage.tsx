import React from 'react';
import { Eye, Image } from 'lucide-react';

interface LazyImageProps {
  src?: string | null;
  alt: string;
  className?: string;
  onClick?: () => void;
  title?: string;
}

export const LazyImage: React.FC<LazyImageProps> = ({
  src,
  alt,
  className = "w-10 h-10 object-cover rounded-lg cursor-pointer hover:opacity-75 transition-opacity",
  onClick,
  title = "לחץ לצפייה בתמונה מוגדלת"
}) => {

  const handleImageClick = () => {
    // תמיד פתח את התמונה בגדול (דיאלוג) כאשר לוחצים על אייקון העין
    if (onClick) {
      onClick();
    }
  };

  // אם אין תמונה - הצג placeholder
  if (!src) {
    return (
      <div 
        className={`bg-gray-100 rounded-lg flex items-center justify-center ${className}`}
        title="אין תמונה זמינה"
      >
        <Image className="w-5 h-5 text-gray-400" />
      </div>
    );
  }

  // הצג אייקון עין שפותח את התמונה בגדול
  return (
    <div 
      className={`bg-gray-50 border border-gray-200 rounded-lg flex items-center justify-center ${className}`}
      onClick={handleImageClick}
      title="לחץ לצפייה בתמונה מוגדלת"
    >
      <Eye className="w-5 h-5 text-gray-500" />
    </div>
  );
}; 