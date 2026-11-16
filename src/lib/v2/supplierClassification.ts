export type SupplierListRole = 'all' | 'local' | 'import';

export function classificationColumn(role: Exclude<SupplierListRole, 'all'>): 'serves_import' | 'serves_local' {
  return role === 'import' ? 'serves_import' : 'serves_local';
}

export function missingClassificationColumn(error: { message?: string; code?: string } | null): boolean {
  const raw = `${error?.code ?? ''} ${error?.message ?? ''}`;
  return /serves_import|serves_local|42703|PGRST204/i.test(raw);
}
