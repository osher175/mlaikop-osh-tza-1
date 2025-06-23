
import React, { useState } from 'react';
import { JoinBusinessHeader } from '@/components/join-business/JoinBusinessHeader';
import { JoinBusinessForm } from '@/components/join-business/JoinBusinessForm';
import { JoinBusinessSuccess } from '@/components/join-business/JoinBusinessSuccess';

export const JoinBusiness: React.FC = () => {
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSuccess = () => {
    setIsSuccess(true);
  };

  if (isSuccess) {
    return <JoinBusinessSuccess />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-accent-50 flex items-center justify-center p-4" dir="rtl">
      <div className="w-full max-w-2xl">
        <JoinBusinessHeader />
        <JoinBusinessForm onSuccess={handleSuccess} />
      </div>
    </div>
  );
};
