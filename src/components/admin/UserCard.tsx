
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  User, 
  Mail, 
  Eye, 
  Edit, 
  Trash2, 
  UserCheck, 
  UserX,
  AlertTriangle,
  Loader2
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { SearchUser } from '@/hooks/useAdminUserSearch';

interface UserCardProps {
  user: SearchUser;
  onToggleStatus: (userId: string) => void;
  onDelete: (userId: string) => void;
  isToggling: boolean;
  isDeleting: boolean;
}

export const UserCard: React.FC<UserCardProps> = ({
  user,
  onToggleStatus,
  onDelete,
  isToggling,
  isDeleting
}) => {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const navigate = useNavigate();

  const fullName = `${user.first_name} ${user.last_name}`.trim() || 'לא צוין';

  const handleToggleStatus = () => {
    onToggleStatus(user.user_id);
  };

  const handleDelete = () => {
    console.log('Confirming deletion for user:', user.user_id, user.email);
    onDelete(user.user_id);
    setShowDeleteDialog(false);
  };

  const handleViewProfile = () => {
    navigate(`/admin/user/${user.user_id}`);
  };

  return (
    <Card className="hover:shadow-md transition-shadow" dir="rtl">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-100 rounded-full">
              <User className="h-4 w-4 text-gray-600" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">{fullName}</h3>
              <div className="flex items-center gap-1 text-sm text-gray-600">
                <Mail className="h-3 w-3" />
                <span>{user.email}</span>
              </div>
              <div className="text-xs text-gray-500 mt-1">
                ID: {user.user_id}
              </div>
            </div>
          </div>
          
          <Badge 
            className={`${user.is_active 
              ? 'bg-green-500 hover:bg-green-600' 
              : 'bg-red-500 hover:bg-red-600'
            } text-white`}
          >
            {user.is_active ? 'משתמש פעיל' : 'משתמש לא פעיל'}
          </Badge>
        </div>

        <div className="flex gap-2 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            className="flex items-center gap-1"
            onClick={handleViewProfile}
          >
            <Eye className="h-3 w-3" />
            צפייה בפרופיל
          </Button>

          <Button
            size="sm"
            variant="outline"
            className="flex items-center gap-1"
          >
            <Edit className="h-3 w-3" />
            עריכה
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={handleToggleStatus}
            disabled={isToggling || isDeleting}
            className={`flex items-center gap-1 ${
              user.is_active 
                ? 'text-red-600 hover:text-red-700' 
                : 'text-green-600 hover:text-green-700'
            }`}
          >
            {isToggling ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : user.is_active ? (
              <>
                <UserX className="h-3 w-3" />
                השבתה
              </>
            ) : (
              <>
                <UserCheck className="h-3 w-3" />
                הפעלה
              </>
            )}
          </Button>

          <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
            <AlertDialogTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                disabled={isDeleting || isToggling}
                className="flex items-center gap-1 text-red-600 hover:text-red-700"
              >
                {isDeleting ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Trash2 className="h-3 w-3" />
                )}
                מחיקה
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent dir="rtl">
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                  אישור מחיקת משתמש
                </AlertDialogTitle>
                <AlertDialogDescription>
                  האם אתה בטוח שברצונך למחוק את המשתמש {fullName} ({user.email})?
                  <br />
                  <br />
                  <strong>פעולה זו לא ניתנת לביטול ותמחק:</strong>
                  <ul className="list-disc list-inside mt-2 text-sm">
                    <li>את המשתמש מכל מערכות האימות</li>
                    <li>את כל הנתונים הקשורים למשתמש</li>
                    <li>את הפרופיל והגדרות המשתמש</li>
                  </ul>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>ביטול</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="bg-red-600 hover:bg-red-700"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin ml-2" />
                      מוחק...
                    </>
                  ) : (
                    'מחק משתמש'
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
};
