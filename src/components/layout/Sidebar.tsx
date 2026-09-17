import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboardIcon,
  ZapIcon,
  RadarIcon,
  NewspaperIcon,
  CalendarIcon,
  CalculatorIcon,
  BookOpenIcon,
  ShieldIcon,
  SettingsIcon } from
'lucide-react';
import { Logo } from '../common/Logo';
import { useAuth } from '../../context/AuthContext';
const NAV = [
{
  to: '/app/dashboard',
  label: 'Dashboard',
  icon: LayoutDashboardIcon
},
{
  to: '/app/signals',
  label: 'Signals',
  icon: ZapIcon
},
{
  to: '/app/god-signal',
  label: 'BULLER Signal',
  icon: RadarIcon,
  badge: 'NEW'
},
{
  to: '/app/news',
  label: 'News',
  icon: NewspaperIcon
},
{
  to: '/app/calendar',
  label: 'Calendar',
  icon: CalendarIcon
},
{
  to: '/app/calculators',
  label: 'Calculators',
  icon: CalculatorIcon
},
{
  to: '/app/journal',
  label: 'Gold Journal',
  icon: BookOpenIcon
}];

const ADMIN = [
{
  to: '/app/admin',
  label: 'Admin Panel',
  icon: ShieldIcon,
  adminOnly: true
},
{
  to: '/app/settings',
  label: 'Settings',
  icon: SettingsIcon
}];

interface SidebarProps {
  onNavigate?: () => void;
  collapsed?: boolean;
}
export function Sidebar({ onNavigate, collapsed }: SidebarProps) {
  const { user } = useAuth();
  return (
    <aside
      className={`${collapsed ? 'w-16' : 'w-60'} shrink-0 bg-bg-800 border-r border-line flex flex-col h-full`}>
      
      <div
        className={`${collapsed ? 'px-3' : 'px-4'} py-4 border-b border-line`}>
        
        <Logo size="sm" showText={!collapsed} />
      </div>
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {NAV.map((n) =>
        <NavItem
          key={n.to}
          {...n}
          collapsed={collapsed}
          onNavigate={onNavigate} />

        )}
        <div
          className={`${collapsed ? 'mx-2' : 'mx-3'} my-3 border-t border-line`} />
        
        {ADMIN.filter(
          (item) =>
          !('adminOnly' in item) ||
          (item as {adminOnly?: boolean;}).adminOnly !== true ||
          user?.role === 'admin' ||
          user?.role === 'super_admin'
        ).map((n) =>
        <NavItem
          key={n.to}
          {...n}
          collapsed={collapsed}
          onNavigate={onNavigate} />

        )}
      </nav>
      {!collapsed &&
      <div className="p-3 border-t border-line">
          <div className="bg-bg-700 border border-brand/20 rounded-md p-3">
            <div className="text-2xs uppercase tracking-wider text-brand font-bold">
              PRO Access
            </div>
            <div className="text-2xs text-ink-muted mt-1 leading-relaxed">
              Hidden Knowledge Engine active. SMC / ICT / AMD / Liquidity.
            </div>
          </div>
        </div>
      }
    </aside>);

}
function NavItem({
  to,
  label,
  icon: Icon,
  collapsed,
  onNavigate,
  badge







}: {to: string;label: string;icon: any;collapsed?: boolean;onNavigate?: () => void;badge?: string;}) {
  return (
    <NavLink
      to={to}
      onClick={onNavigate}
      className={({ isActive }) =>
      `flex items-center gap-3 ${collapsed ? 'justify-center px-2' : 'px-3'} py-2 rounded-md text-sm transition-colors ${isActive ? 'bg-brand/15 text-brand border border-brand/25' : 'text-ink-muted hover:text-ink hover:bg-bg-700 border border-transparent'}`
      }>
      
      <Icon className="w-4 h-4 shrink-0" />
      {!collapsed && <span className="font-medium flex-1">{label}</span>}
      {!collapsed && badge &&
      <span className="text-3xs font-bold uppercase tracking-wider text-brand bg-brand/15 border border-brand/30 px-1.5 py-0.5 rounded">
          {badge}
        </span>
      }
    </NavLink>);

}