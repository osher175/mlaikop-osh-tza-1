import {
  Home, Package, ShoppingCart, Truck, Undo2, Layers, BarChart3, Users, Settings,
  Ship, PlusCircle, KeyRound, Crown, Shield, HardDrive, User, type LucideIcon,
} from 'lucide-react';

export interface V2NavItem {
  key: string;
  label: string;
  icon: LucideIcon;
  /** Existing route. `null` = not implemented yet → shown as unavailable, never linked. */
  to: string | null;
  show: boolean;
}

interface Perms {
  isPlatformAdmin: boolean;
  canViewProducts: boolean;
  canEditProducts: boolean;
  canViewReports: boolean;
  canManageSettings: boolean;
}

/** Same permission rules as the legacy Sidebar. */
export function buildV2Nav(p: Perms): { primary: V2NavItem[]; secondary: V2NavItem[] } {
  if (p.isPlatformAdmin) {
    return {
      primary: [
        { key: 'admin-dash', label: 'דשבורד מנהל', icon: BarChart3, to: '/admin/dashboard', show: true },
        { key: 'admin', label: 'פאנל מנהל', icon: Shield, to: '/admin', show: true },
        { key: 'users', label: 'ניהול משתמשים', icon: Users, to: '/users', show: true },
        { key: 'storage', label: 'ניהול אחסון', icon: HardDrive, to: '/admin/storage', show: true },
        { key: 'admin-settings', label: 'הגדרות מערכת', icon: Settings, to: '/admin/settings', show: true },
        { key: 'profile', label: 'פרופיל אישי', icon: User, to: '/profile', show: true },
      ],
      secondary: [],
    };
  }
  const primary: V2NavItem[] = [
    { key: 'dashboard', label: 'לוח בקרה', icon: Home, to: '/dashboard', show: true },
    { key: 'inventory', label: 'מלאי', icon: Package, to: '/inventory', show: p.canViewProducts },
    { key: 'sales', label: 'מכירה', icon: ShoppingCart, to: null, show: p.canViewProducts },
    { key: 'purchasing', label: 'רכש', icon: Truck, to: '/procurement', show: p.canEditProducts },
    { key: 'returns', label: 'החזרות לספקים', icon: Undo2, to: null, show: p.canEditProducts },
    { key: 'movements', label: 'תנועות מלאי', icon: Layers, to: null, show: p.canViewProducts },
    { key: 'reports', label: 'דוחות', icon: BarChart3, to: '/reports', show: p.canViewReports },
    { key: 'employees', label: 'עובדים', icon: Users, to: null, show: p.canManageSettings },
    { key: 'settings', label: 'הגדרות עסק', icon: Settings, to: '/settings', show: p.canManageSettings },
  ];
  // Existing destinations not in the V2 menu list — kept reachable so nothing is lost.
  const secondary: V2NavItem[] = [
    { key: 'suppliers', label: 'ספקים', icon: Truck, to: '/suppliers', show: p.canViewProducts },
    { key: 'import', label: 'יבוא', icon: Ship, to: '/import', show: p.canManageSettings },
    { key: 'add-product', label: 'הוספת מוצר', icon: PlusCircle, to: '/add-product', show: p.canEditProducts },
    { key: 'api', label: 'API ואינטגרציות', icon: KeyRound, to: '/settings/api', show: p.canManageSettings },
    { key: 'subscriptions', label: 'ניהול מנוי', icon: Crown, to: '/subscriptions', show: true },
  ];
  return { primary: primary.filter((i) => i.show), secondary: secondary.filter((i) => i.show) };
}

export function isNavActive(pathname: string, to: string | null) {
  if (!to) return false;
  return pathname === to || pathname.startsWith(to + '/');
}
