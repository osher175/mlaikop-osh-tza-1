
import React, { useState } from 'react';
import { useInView } from 'react-intersection-observer';
import { cn } from '@/lib/utils';

interface LazyImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  className?: string;
  thumbnailSrc?: string;
}

export const LazyImage: React.FC<LazyImageProps> = ({
  src,
  alt,
  className,
  thumbnailSrc,
  ...props
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const { ref, inView } = useInView({
    triggerOnce: true,
    threshold: 0.1,
  });

  const handleLoad = () => {
    setIsLoaded(true);
  };

  const handleError = () => {
    setHasError(true);
  };

  return (
    <div ref={ref} className={cn('relative overflow-hidden', className)}>
      {inView && (
        <>
          {!isLoaded && !hasError && (
            <div className="absolute inset-0 bg-gray-200 animate-pulse rounded" />
          )}
          
          {hasError ? (
            <div className="w-full h-full bg-gray-100 flex items-center justify-center text-gray-400 text-sm">
              שגיאה בטעינת תמונה
            </div>
          ) : (
            <img
              src={thumbnailSrc && !isLoaded ? thumbnailSrc : src}
              alt={alt}
              onLoad={handleLoad}
              onError={handleError}
              className={cn(
                'w-full h-full object-cover transition-opacity duration-300',
                isLoaded ? 'opacity-100' : 'opacity-0'
              )}
              {...props}
            />
          )}
        </>
      )}
    </div>
  );
};
