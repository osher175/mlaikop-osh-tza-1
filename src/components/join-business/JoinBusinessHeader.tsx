
import React from 'react';
import { Users } from 'lucide-react';

export const JoinBusinessHeader: React.FC = () => {
  return (
    <div className="text-center mb-8">
      <div className="w-16 h-16 bg-accent rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
        <Users className="w-8 h-8 text-white" />
      </div>
      <h1 className="text-3xl font-bold text-gray-900 mb-2">הצטרפות לעסק קיים</h1>
      <p className="text-gray-600">מלא את הפרטים כדי לשלוח בקשת הצטרפות</p>
    </div>
  );
};
