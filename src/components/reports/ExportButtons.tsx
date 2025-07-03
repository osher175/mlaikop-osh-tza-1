
import React from 'react';
import { Button } from '@/components/ui/button';
import { Download, FileText, Table } from 'lucide-react';
import { ReportsData } from '@/types/reports';

interface ExportButtonsProps {
  reportsData: ReportsData;
  selectedRange: string;
}

const ExportButtons: React.FC<ExportButtonsProps> = ({ reportsData, selectedRange }) => {
  const exportToPDF = async () => {
    try {
      const jsPDF = (await import('jspdf')).default;
      const doc = new jsPDF();
      
      // Set RTL direction and Hebrew font
      doc.setR2L(true);
      doc.setFontSize(16);
      doc.text('דוח עסקי - ' + selectedRange, 105, 20, { align: 'center' });
      
      // Add report data
      doc.setFontSize(12);
      let yPosition = 40;
      
      doc.text('סה"כ נכנסו: ' + reportsData.total_added, 20, yPosition);
      yPosition += 10;
      doc.text('סה"כ יצאו: ' + reportsData.total_removed, 20, yPosition);
      yPosition += 10;
      doc.text('שווי מלאי: ₪' + reportsData.total_value.toLocaleString(), 20, yPosition);
      yPosition += 10;
      doc.text('רווח גולמי: ₪' + reportsData.gross_profit.toLocaleString(), 20, yPosition);
      yPosition += 10;
      doc.text('רווח נטו: ₪' + reportsData.net_profit.toLocaleString(), 20, yPosition);
      yPosition += 10;
      
      if (reportsData.top_product) {
        doc.text('המוצר הפופולרי ביותר: ' + reportsData.top_product, 20, yPosition);
      }
      
      doc.save(`דוח-עסקי-${selectedRange}-${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (error) {
      console.error('Error exporting to PDF:', error);
    }
  };

  const exportToExcel = async () => {
    try {
      const XLSX = await import('xlsx');
      
      // Create worksheet data
      const wsData = [
        ['דוח עסקי', selectedRange],
        [''],
        ['מדד', 'ערך'],
        ['סה"כ נכנסו', reportsData.total_added],
        ['סה"כ יצאו', reportsData.total_removed],
        ['שווי מלאי', reportsData.total_value],
        ['רווח גולמי', reportsData.gross_profit],
        ['רווח נטו', reportsData.net_profit],
        ['המוצר הפופולרי ביותר', reportsData.top_product || 'לא זמין'],
      ];

      // Create workbook and worksheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      
      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(wb, ws, 'דוח עסקי');
      
      // Save file
      XLSX.writeFile(wb, `דוח-עסקי-${selectedRange}-${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (error) {
      console.error('Error exporting to Excel:', error);
    }
  };

  return (
    <div className="flex gap-2">
      <Button onClick={exportToPDF} variant="outline" className="flex items-center gap-2">
        <FileText className="w-4 h-4" />
        יצוא PDF
      </Button>
      <Button onClick={exportToExcel} variant="outline" className="flex items-center gap-2">
        <Table className="w-4 h-4" />
        יצוא Excel
      </Button>
    </div>
  );
};

export default ExportButtons;
