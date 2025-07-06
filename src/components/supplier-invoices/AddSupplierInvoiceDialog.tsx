import React, { useState, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSuppliers } from '@/hooks/useSuppliers';
import { useSupplierInvoices } from '@/hooks/useSupplierInvoices';
import { Upload, Camera, X } from 'lucide-react';
import { ImageUpload } from '@/components/ui/image-upload';

interface AddSupplierInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const AddSupplierInvoiceDialog: React.FC<AddSupplierInvoiceDialogProps> = ({
  open,
  onOpenChange,
}) => {
  const { suppliers } = useSuppliers();
  const { createInvoice } = useSupplierInvoices();
  
  const [formData, setFormData] = useState({
    supplier_id: '',
    invoice_date: '',
    amount: '',
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string>('');
  const [showCameraCapture, setShowCameraCapture] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.supplier_id || !formData.invoice_date || !formData.amount) {
      return;
    }

    await createInvoice.mutateAsync({
      supplier_id: formData.supplier_id,
      invoice_date: formData.invoice_date,
      amount: parseFloat(formData.amount),
      file: selectedFile || undefined,
    });

    // Reset form
    setFormData({
      supplier_id: '',
      invoice_date: '',
      amount: '',
    });
    setSelectedFile(null);
    setImageUrl('');
    setShowCameraCapture(false);
    onOpenChange(false);
  };

  const handleImageUpload = (uploadedImageUrl: string) => {
    setImageUrl(uploadedImageUrl);
    // Convert the uploaded image URL to a file for submission
    fetch(uploadedImageUrl)
      .then(res => res.blob())
      .then(blob => {
        const file = new File([blob], 'invoice-image.jpg', { type: 'image/jpeg' });
        setSelectedFile(file);
      })
      .catch(error => {
        console.error('Error converting image URL to file:', error);
      });
  };

  const handleImageRemove = () => {
    setImageUrl('');
    setSelectedFile(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
      if (allowedTypes.includes(file.type)) {
        setSelectedFile(file);
        setImageUrl(''); // Clear image upload if file is selected
      } else {
        alert('נא לבחור קובץ PDF, JPG או PNG בלבד');
      }
    }
  };

  const startCameraCapture = () => {
    setShowCameraCapture(true);
  };

  const handleCameraCapture = (imageDataUrl: string) => {
    // Convert data URL to blob and then to file
    fetch(imageDataUrl)
      .then(res => res.blob())
      .then(blob => {
        const file = new File([blob], 'camera-capture.jpg', { type: 'image/jpeg' });
        setSelectedFile(file);
        
        // Create object URL for preview
        const objectUrl = URL.createObjectURL(blob);
        setImageUrl(objectUrl);
        setShowCameraCapture(false);
      })
      .catch(error => {
        console.error('Error processing camera capture:', error);
      });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[500px]" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-right">הוסף חשבונית ספק</DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="supplier-select">ספק *</Label>
              <Select
                value={formData.supplier_id}
                onValueChange={(value) => setFormData(prev => ({ ...prev, supplier_id: value }))}
                required
              >
                <SelectTrigger className="text-right">
                  <SelectValue placeholder="בחר ספק" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((supplier) => (
                    <SelectItem key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="invoice-date">תאריך החשבונית *</Label>
              <Input
                id="invoice-date"
                type="date"
                value={formData.invoice_date}
                onChange={(e) => setFormData(prev => ({ ...prev, invoice_date: e.target.value }))}
                className="text-right"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">סכום (₪) *</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                value={formData.amount}
                onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                placeholder="הכנס סכום"
                className="text-right"
                required
              />
            </div>

            <div className="space-y-2">
              <Label>קובץ מצורף</Label>
              <div className="space-y-3">
                {/* Camera Capture Button */}
                <div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={startCameraCapture}
                    className="w-full flex items-center gap-2"
                  >
                    <Camera className="w-4 h-4" />
                    צלם חשבונית
                  </Button>
                </div>

                {/* Image Upload Section */}
                {imageUrl && (
                  <div>
                    <Label className="text-sm text-gray-600 mb-2 block">תצוגה מקדימה</Label>
                    <ImageUpload
                      currentImageUrl={imageUrl}
                      onImageUpload={handleImageUpload}
                      onImageRemove={handleImageRemove}
                      className="w-full"
                    />
                  </div>
                )}

                {/* File Upload Section */}
                <div>
                  <Label className="text-sm text-gray-600 mb-2 block">או העלה קובץ (PDF, JPG, PNG)</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="file-upload"
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    <Label
                      htmlFor="file-upload"
                      className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-md cursor-pointer hover:bg-gray-50 flex-1 justify-center"
                    >
                      <Upload className="w-4 h-4" />
                      {selectedFile && !imageUrl ? selectedFile.name : 'בחר קובץ'}
                    </Label>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={createInvoice.isPending}
              >
                ביטול
              </Button>
              <Button
                type="submit"
                disabled={createInvoice.isPending}
                className="bg-turquoise hover:bg-turquoise/90"
              >
                {createInvoice.isPending ? 'שומר...' : 'שמור חשבונית'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Camera Capture Modal */}
      {showCameraCapture && (
        <CameraCaptureModal
          open={showCameraCapture}
          onClose={() => setShowCameraCapture(false)}
          onCapture={handleCameraCapture}
        />
      )}
    </>
  );
};

// Camera Capture Modal Component
interface CameraCaptureModalProps {
  open: boolean;
  onClose: () => void;
  onCapture: (imageDataUrl: string) => void;
}

const CameraCaptureModal: React.FC<CameraCaptureModalProps> = ({
  open,
  onClose,
  onCapture,
}) => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string>('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const startCamera = useCallback(async () => {
    try {
      setError('');
      console.log('Starting camera...');
      
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'environment', // Use back camera on mobile
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });
      
      console.log('Camera stream obtained:', mediaStream);
      setStream(mediaStream);
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.play();
        console.log('Video element set up successfully');
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      setError('לא ניתן לגשת למצלמה. אנא ודא שנתת הרשאה לשימוש במצלמה.');
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (stream) {
      console.log('Stopping camera stream');
      stream.getTracks().forEach(track => {
        track.stop();
        console.log('Track stopped:', track.kind);
      });
      setStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, [stream]);

  React.useEffect(() => {
    if (open) {
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [open, startCamera, stopCamera]);

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) {
      console.error('Video or canvas ref not available');
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) {
      console.error('Canvas context not available');
      return;
    }

    // Set canvas size to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    console.log('Capturing photo with dimensions:', canvas.width, 'x', canvas.height);

    // Draw the current video frame to canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Convert to data URL
    const imageDataUrl = canvas.toDataURL('image/jpeg', 0.8);
    console.log('Photo captured, data URL length:', imageDataUrl.length);
    
    onCapture(imageDataUrl);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-center">צלם חשבונית</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {error ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
              <p className="text-red-700">{error}</p>
              <Button 
                onClick={startCamera} 
                className="mt-2"
                variant="outline"
              >
                נסה שוב
              </Button>
            </div>
          ) : (
            <>
              <div className="relative bg-black rounded-lg overflow-hidden">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-64 object-cover"
                  onLoadedMetadata={() => {
                    console.log('Video metadata loaded');
                  }}
                  onCanPlay={() => {
                    console.log('Video can play');
                  }}
                />
                
                {/* Overlay guide */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="border-2 border-white border-dashed rounded-lg w-4/5 h-3/4 opacity-50"></div>
                </div>
              </div>
              
              <div className="text-center text-sm text-gray-600">
                מקם את החשבונית במרכז המסגרת ולחץ על צלם
              </div>
              
              <div className="flex gap-3 justify-center">
                <Button onClick={capturePhoto} className="flex items-center gap-2">
                  <Camera className="w-4 h-4" />
                  צלם
                </Button>
                <Button variant="outline" onClick={onClose}>
                  ביטול
                </Button>
              </div>
            </>
          )}
        </div>
        
        {/* Hidden canvas for image capture */}
        <canvas ref={canvasRef} className="hidden" />
      </DialogContent>
    </Dialog>
  );
};
