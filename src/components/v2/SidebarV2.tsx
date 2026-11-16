import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useUserRole } from '@/hooks/useUserRole';
import mlaikoLogo from '@/assets/mlaiko-logo-full.png';
import { buildV2Nav, isNavActive, type V2NavItem } from './navConfig';

interface Props {
  collapsed?: boolean;
  onNavigate?: () => void;
}

const NavRow: React.FC<{ item: V2NavItem; collapsed?: boolean; active: boolean; onNavigate?: () => void }> = ({
  item, collapsed, active, onNavigate,
}) => {
  const Icon = item.icon;
  const base = cn(
    'relative flex items-center h-11 rounded-[14px] font-semibold text-[15px] transition-colors duration-300',
    collapsed ? 'justify-center px-0' : 'gap-3 px-3.5',
  );
  const content = (
    <>
      <Icon className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
      {collapsed ? <span className="sr-only">{item.label}</span> : <span className="truncate">{item.label}</span>}
      {!item.to && <span className="sr-only">עדיין לא זמין</span>}
    </>
  );
  if (!item.to) {
    return (
      <div aria-disabled="true" title={`${item.label} — עדיין לא זמין`} className={cn(base, 'text-v2-muted/60 cursor-not-allowed')}>
        {content}
      </div>
    );
  }
  return (
    <Link
      to={item.to}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      title={collapsed ? item.label : undefined}
      className={cn(
        base,
        active
          ? 'bg-v2-primary text-white shadow-[0_8px_18px_rgba(13,148,136,0.28)]'
          : 'text-v2-navy hover:bg-v2-table-head',
      )}
    >
      {content}
    </Link>
  );
};

export const SidebarV2: React.FC<Props> = ({ collapsed, onNavigate }) => {
  const { pathname } = useLocation();
  const { permissions } = useUserRole();
  const { primary, secondary } = buildV2Nav(permissions);

  return (
    <div className="h-full flex flex-col bg-v2-surface">
      <div className={cn('flex items-center border-b border-v2-border shrink-0', collapsed ? 'h-[76px] justify-center px-2' : 'min-h-[88px] gap-3 px-4 py-3')}>
        <img
          src={mlaikoLogo}
          alt={collapsed ? 'Mlaiko' : ''}
          className={cn('object-contain shrink-0', collapsed ? 'h-14 w-14' : 'h-16 w-16')}
        />
        {!collapsed && (
          <span className="text-[18px] font-extrabold tracking-tight text-[#1f2a44]">Mlaiko</span>
        )}
      </div>
      <nav aria-label="ניווט ראשי" className="flex-1 overflow-y-auto overscroll-contain p-2 space-y-1">
        {primary.map((item) => (
          <NavRow key={item.key} item={item} collapsed={collapsed} active={isNavActive(pathname, item.to)} onNavigate={onNavigate} />
        ))}
        {secondary.length > 0 && (
          <>
            <div className="my-2 border-t border-v2-border" role="separator" />
            {!collapsed && <p className="px-4 pb-1 text-xs font-semibold text-v2-muted">עוד</p>}
            {secondary.map((item) => (
              <NavRow key={item.key} item={item} collapsed={collapsed} active={isNavActive(pathname, item.to)} onNavigate={onNavigate} />
            ))}
          </>
        )}
      </nav>
      {!collapsed && <div className="p-4 text-center text-[12px] text-v2-muted border-t border-v2-border">Mlaiko {new Date().getFullYear()} ©</div>}
    </div>
  );
};
