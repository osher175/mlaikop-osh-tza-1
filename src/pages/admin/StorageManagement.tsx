import React, { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { HardDrive, Trash2, Search, AlertTriangle, FileImage, Loader2 } from 'lucide-react';
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

export default function StorageManagement() {
  const [stats, setStats] = useState<StorageStats | null>(null);
  const [orphans, setOrphans] = useState<OrphanStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
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
            <p className="text-muted-foreground">נהל ופנה מקום באחסון התמונות</p>
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
                תמונות מעל 500KB - שקול להחליף אותן בגרסאות מוקטנות
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
      </div>
    </MainLayout>
  );
}
