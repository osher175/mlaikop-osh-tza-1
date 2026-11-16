import React from 'react';
import { CreateImportWizard } from '@/components/import/wizard/CreateImportWizard';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CreateImportOrderDialog: React.FC<Props> = (props) => (
  <CreateImportWizard {...props} />
);
