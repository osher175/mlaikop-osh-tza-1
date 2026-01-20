import React, { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { HardDrive, Trash2, Search, AlertTriangle, FileImage, Loader2, Shrink, CheckCircle } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface StorageStats {
  totalFiles: number;
  totalSizeBytes: number;
  totalSizeMB: string;
  largeFilesCount: number;
  largeFiles: Array<{ name: string; size: number; path: string }>;
}

interface OrphanStats {
  orphanCount: number;
  orphanSizeBytes: number;
  orphanSizeMB: string;
  orphanFiles: Array<{ name: string; size: number; path: string }>;
}

interface CompressionResult {
  success: boolean;
  batchInfo?: {
    offset: number;
    batchSize: number;
    processedInBatch: number;
    totalLargeFiles: number;
    nextOffset: number | null;
    hasMore: boolean;
    progressPercent: number;
  };
  processed: number;
  skipped: number;
  errors: number;
  totalSavedBytes: number;
  totalSavedMB: string;
  results: Array<{ file: string; saved: number; error?: string }>;
}

export default function StorageManagement() {
  const [stats, setStats] = useState<StorageStats | null>(null);
  const [orphans, setOrphans] = useState<OrphanStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showCompressDialog, setShowCompressDialog] = useState(false);
  const [compressionResult, setCompressionResult] = useState<CompressionResult | null>(null);
  const [compressionProgress, setCompressionProgress] = useState<{
    current: number;
    total: number;
    savedMB: number;
    processed: number;
    errors: number;
  } | null>(null);
  const { toast } = useToast();

  const maxStorageGB = 1.019; // Free plan limit
  const usedStorageGB = stats ? parseFloat(stats.totalSizeMB) / 1024 : 0;
  const usagePercent = (usedStorageGB / maxStorageGB) * 100;

  const fetchStats = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('compress-storage-images', {
        body: { action: 'list' },
      });

      if (error) throw error;
      setStats(data);
    } catch (error: any) {
      console.error('Error fetching stats:', error);
      toast({
        title: 'שגיאה בטעינת נתונים',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const findOrphans = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('compress-storage-images', {
        body: { action: 'find-orphans' },
      });

      if (error) throw error;
      setOrphans(data);

      if (data.orphanCount === 0) {
        toast({
          title: 'מצוין!',
          description: 'לא נמצאו תמונות יתומות',
        });
      }
    } catch (error: any) {
      console.error('Error finding orphans:', error);
      toast({
        title: 'שגיאה בחיפוש',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const deleteOrphans = async () => {
    setIsDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke('compress-storage-images', {
        body: { action: 'delete-orphans' },
      });

      if (error) throw error;

      toast({
        title: 'הצלחה!',
        description: `נמחקו ${data.deletedCount} תמונות יתומות`,
      });

      setOrphans(null);
      fetchStats();
    } catch (error: any) {
      console.error('Error deleting orphans:', error);
      toast({
        title: 'שגיאה במחיקה',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  const compressAllImages = async () => {
    setIsCompressing(true);
    setCompressionResult(null);
    setCompressionProgress(null);
    
    let offset = 0;
    const batchSize = 10;
    let totalSavedMB = 0;
    let totalProcessed = 0;
    let totalErrors = 0;
    let totalFiles = 0;
    
    try {
      // First batch to get total count
      const firstResult = await supabase.functions.invoke('compress-storage-images', {
        body: { action: 'compress-batch', offset: 0, batchSize },
      });

      if (firstResult.error) throw firstResult.error;
      
      totalFiles = firstResult.data.batchInfo?.totalLargeFiles || 0;
      totalSavedMB += parseFloat(firstResult.data.totalSavedMB || '0');
      totalProcessed += firstResult.data.processed || 0;
      totalErrors += firstResult.data.errors || 0;
      offset = firstResult.data.batchInfo?.nextOffset || 0;
      
      setCompressionProgress({
        current: firstResult.data.batchInfo?.processedInBatch || 0,
        total: totalFiles,
        savedMB: totalSavedMB,
        processed: totalProcessed,
        errors: totalErrors,
      });

      // Continue with remaining batches
      while (firstResult.data.batchInfo?.hasMore && offset < totalFiles) {
        const { data, error } = await supabase.functions.invoke('compress-storage-images', {
          body: { action: 'compress-batch', offset, batchSize },
        });

        if (error) {
          console.error('Batch error:', error);
          totalErrors++;
          break;
        }

        totalSavedMB += parseFloat(data.totalSavedMB || '0');
        totalProcessed += data.processed || 0;
        totalErrors += data.errors || 0;
        offset = data.batchInfo?.nextOffset || offset + batchSize;

        setCompressionProgress({
          current: offset,
          total: totalFiles,
          savedMB: totalSavedMB,
          processed: totalProcessed,
          errors: totalErrors,
        });

        if (!data.batchInfo?.hasMore) break;
      }

      // Final result
      setCompressionResult({
        success: true,
        batchInfo: {
          offset: 0,
          batchSize,
          processedInBatch: totalFiles,
          totalLargeFiles: totalFiles,
          nextOffset: null,
          hasMore: false,
          progressPercent: 100,
        },
        processed: totalProcessed,
        skipped: totalFiles - totalProcessed - totalErrors,
        errors: totalErrors,
        totalSavedBytes: totalSavedMB * 1024 * 1024,
        totalSavedMB: totalSavedMB.toFixed(2),
        results: [],
      });
      
      toast({
        title: 'דחיסה הושלמה!',
        description: `נחסכו ${totalSavedMB.toFixed(2)} MB מ-${totalProcessed} תמונות`,
      });

      fetchStats();
    } catch (error: any) {
      console.error('Error compressing images:', error);
      toast({
        title: 'שגיאה בדחיסה',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsCompressing(false);
      setShowCompressDialog(false);
      setCompressionProgress(null);
    }
  };

  const compressSingleImage = async (filePath: string) => {
    try {
      toast({
        title: 'מבצע דחיסה...',
        description: filePath,
      });

      const { data, error } = await supabase.functions.invoke('compress-storage-images', {
        body: { action: 'compress-single', filePath },
      });

      if (error) throw error;

      if (data.savedBytes > 0) {
        toast({
          title: 'נדחס בהצלחה!',
          description: `נחסכו ${(data.savedBytes / 1024).toFixed(0)} KB (${data.compressionRatio}%)`,
        });
      } else {
        toast({
          title: 'התמונה כבר מותאמת',
          description: 'לא ניתן לדחוס יותר',
        });
      }

      fetchStats();
    } catch (error: any) {
      toast({
        title: 'שגיאה בדחיסה',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const deleteFile = async (filePath: string) => {
    try {
      const { error } = await supabase.functions.invoke('compress-storage-images', {
        body: { action: 'delete', filePath },
      });

      if (error) throw error;

      toast({
        title: 'הקובץ נמחק',
        description: filePath,
      });

      fetchStats();
    } catch (error: any) {
      toast({
        title: 'שגיאה במחיקה',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <MainLayout>
      <div className="container mx-auto py-6 px-4" dir="rtl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">ניהול אחסון</h1>
            <p className="text-muted-foreground">נהל, דחוס ופנה מקום באחסון התמונות</p>
          </div>
          <Button onClick={fetchStats} disabled={isLoading}>
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : null}
            רענן נתונים
          </Button>
        </div>

        {/* Storage Overview */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HardDrive className="w-5 h-5" />
              סקירת אחסון
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <span>שימוש באחסון</span>
                  <span className={usagePercent > 100 ? 'text-destructive font-bold' : ''}>
                    {stats.totalSizeMB} MB / {(maxStorageGB * 1024).toFixed(0)} MB
                  </span>
                </div>
                <Progress 
                  value={Math.min(usagePercent, 100)} 
                  className={usagePercent > 100 ? '[&>div]:bg-destructive' : ''}
                />
                {usagePercent > 100 && (
                  <div className="flex items-center gap-2 text-destructive text-sm">
                    <AlertTriangle className="w-4 h-4" />
                    חריגה מהמכסה! יש לפנות מקום בדחיפות
                  </div>
                )}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4">
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <div className="text-2xl font-bold">{stats.totalFiles}</div>
                    <div className="text-sm text-muted-foreground">סה"כ קבצים</div>
                  </div>
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <div className="text-2xl font-bold">{stats.totalSizeMB} MB</div>
                    <div className="text-sm text-muted-foreground">נפח כולל</div>
                  </div>
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <div className="text-2xl font-bold">{stats.largeFilesCount}</div>
                    <div className="text-sm text-muted-foreground">קבצים גדולים (&gt;500KB)</div>
                  </div>
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <div className="text-2xl font-bold">{usagePercent.toFixed(0)}%</div>
                    <div className="text-sm text-muted-foreground">ניצול מכסה</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Compression Section */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shrink className="w-5 h-5" />
              דחיסת תמונות
            </CardTitle>
            <CardDescription>
              דחוס את כל התמונות הגדולות (מעל 200KB) כדי לחסוך מקום
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex gap-2">
                <Button 
                  onClick={() => setShowCompressDialog(true)} 
                  disabled={isCompressing || !stats || stats.largeFilesCount === 0}
                  className="bg-primary hover:bg-primary/90"
                >
                  {isCompressing ? (
                    <Loader2 className="w-4 h-4 animate-spin ml-2" />
                  ) : (
                    <Shrink className="w-4 h-4 ml-2" />
                  )}
                  דחוס את כל התמונות הגדולות
                </Button>
              </div>

              {stats && stats.largeFilesCount > 0 && (
                <div className="text-sm text-muted-foreground">
                  נמצאו {stats.largeFilesCount} תמונות גדולות שניתן לדחוס
                </div>
              )}

              {compressionProgress && (
                <div className="p-4 bg-muted rounded-lg space-y-3">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin text-primary" />
                    <span className="font-medium">מבצע דחיסה...</span>
                  </div>
                  <Progress 
                    value={(compressionProgress.current / compressionProgress.total) * 100} 
                  />
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">התקדמות: </span>
                      <span className="font-medium">{compressionProgress.current}/{compressionProgress.total}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">נדחסו: </span>
                      <span className="font-medium">{compressionProgress.processed}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">שגיאות: </span>
                      <span className="font-medium">{compressionProgress.errors}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">נחסכו: </span>
                      <span className="font-medium text-primary">{compressionProgress.savedMB.toFixed(2)} MB</span>
                    </div>
                  </div>
                </div>
              )}

              {compressionResult && !compressionProgress && (
                <div className="p-4 bg-muted rounded-lg space-y-2">
                  <div className="flex items-center gap-2 text-primary">
                    <CheckCircle className="w-5 h-5" />
                    <span className="font-medium">דחיסה הושלמה!</span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">תמונות שנבדקו: </span>
                      <span className="font-medium">{compressionResult.batchInfo?.totalLargeFiles || 0}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">נדחסו: </span>
                      <span className="font-medium">{compressionResult.processed}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">שגיאות: </span>
                      <span className="font-medium">{compressionResult.errors}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">נחסכו: </span>
                      <span className="font-medium text-primary">{compressionResult.totalSavedMB} MB</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Orphan Files Detection */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="w-5 h-5" />
              תמונות יתומות
            </CardTitle>
            <CardDescription>
              תמונות שהועלו אך לא משויכות לאף מוצר - ניתן למחוק אותן בבטחה
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 mb-4">
              <Button onClick={findOrphans} disabled={isLoading} variant="outline">
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : <Search className="w-4 h-4 ml-2" />}
                חפש תמונות יתומות
              </Button>
              {orphans && orphans.orphanCount > 0 && (
                <Button 
                  onClick={() => setShowDeleteDialog(true)} 
                  variant="destructive"
                  disabled={isDeleting}
                >
                  <Trash2 className="w-4 h-4 ml-2" />
                  מחק את כולן ({orphans.orphanCount})
                </Button>
              )}
            </div>

            {orphans && (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <Badge variant={orphans.orphanCount > 0 ? "destructive" : "secondary"}>
                    {orphans.orphanCount} תמונות יתומות
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    נפח: {orphans.orphanSizeMB} MB
                  </span>
                </div>

                {orphans.orphanFiles.length > 0 && (
                  <div className="max-h-60 overflow-y-auto border rounded-lg">
                    {orphans.orphanFiles.map((file) => (
                      <div 
                        key={file.path} 
                        className="flex items-center justify-between p-2 border-b last:border-b-0 hover:bg-muted/50"
                      >
                        <div className="flex items-center gap-2">
                          <FileImage className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm truncate max-w-[200px]">{file.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {formatBytes(file.size)}
                          </span>
                        </div>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          onClick={() => deleteFile(file.path)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Large Files */}
        {stats && stats.largeFiles.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileImage className="w-5 h-5" />
                קבצים גדולים
              </CardTitle>
              <CardDescription>
                תמונות מעל 500KB - לחץ על דחיסה להקטנת גודל הקובץ
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="max-h-60 overflow-y-auto border rounded-lg">
                {stats.largeFiles.map((file) => (
                  <div 
                    key={file.path} 
                    className="flex items-center justify-between p-2 border-b last:border-b-0 hover:bg-muted/50"
                  >
                    <div className="flex items-center gap-2">
                      <FileImage className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm truncate max-w-[200px]">{file.name}</span>
                      <Badge variant="outline">{formatBytes(file.size)}</Badge>
                    </div>
                    <div className="flex gap-1">
                      <Button 
                        size="sm" 
                        variant="ghost"
                        onClick={() => compressSingleImage(file.path)}
                        className="text-primary hover:text-primary"
                      >
                        <Shrink className="w-4 h-4" />
                      </Button>
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        onClick={() => deleteFile(file.path)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent dir="rtl">
            <AlertDialogHeader>
              <AlertDialogTitle>מחיקת תמונות יתומות</AlertDialogTitle>
              <AlertDialogDescription>
                האם אתה בטוח שברצונך למחוק {orphans?.orphanCount} תמונות יתומות?
                פעולה זו תפנה {orphans?.orphanSizeMB} MB של שטח אחסון.
                לא ניתן לבטל פעולה זו.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>ביטול</AlertDialogCancel>
              <AlertDialogAction
                onClick={deleteOrphans}
                className="bg-destructive hover:bg-destructive/90"
                disabled={isDeleting}
              >
                {isDeleting ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : null}
                מחק הכל
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Compress Confirmation Dialog */}
        <AlertDialog open={showCompressDialog} onOpenChange={setShowCompressDialog}>
          <AlertDialogContent dir="rtl">
            <AlertDialogHeader>
              <AlertDialogTitle>דחיסת כל התמונות הגדולות</AlertDialogTitle>
              <AlertDialogDescription>
                פעולה זו תדחוס את כל התמונות מעל 200KB.
                התמונות יוקטנו ל-800 פיקסלים ואיכות 75%.
                תהליך זה עשוי לקחת כמה דקות בהתאם למספר התמונות.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>ביטול</AlertDialogCancel>
              <AlertDialogAction
                onClick={compressAllImages}
                className="bg-primary hover:bg-primary/90"
                disabled={isCompressing}
              >
                {isCompressing ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : null}
                התחל דחיסה
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </MainLayout>
  );
}
