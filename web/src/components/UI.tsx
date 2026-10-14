import type { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
}

export function Card({ children, className = '' }: CardProps) {
  return <div className={`card ${className}`}>{children}</div>;
}

interface StatCardProps {
  label: string;
  value: number | string;
  sub?: string;
}

export function StatCard({ label, value, sub }: StatCardProps) {
  return (
    <Card className="flex flex-col gap-1">
      <span className="text-xs text-ink-faint uppercase tracking-wide">{label}</span>
      <span className="text-2xl font-semibold text-ink-strong">{value}</span>
      {sub && <span className="text-xs text-ink-base">{sub}</span>}
    </Card>
  );
}

interface BadgeProps {
  children: ReactNode;
  color?: 'brand' | 'green' | 'red' | 'yellow' | 'gray';
}

const badgeColors = {
  brand: 'bg-brand-soft text-brand',
  green: 'bg-green-950 text-green-400',
  red: 'bg-red-950 text-red-400',
  yellow: 'bg-yellow-950 text-yellow-400',
  gray: 'bg-surface-hover text-ink-base',
};

export function Badge({ children, color = 'gray' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${badgeColors[color]}`}
    >
      {children}
    </span>
  );
}

interface SpinnerProps {
  label?: string;
}

export function Spinner({ label = 'Carregando...' }: SpinnerProps) {
  return (
    <div className="flex items-center justify-center py-12 text-ink-base text-sm">
      {label}
    </div>
  );
}

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
      <p className="text-ink-strong font-medium">{title}</p>
      {description && <p className="text-ink-base text-sm max-w-sm">{description}</p>}
      {action}
    </div>
  );
}

interface ErrorMessageProps {
  message: string;
}

export function ErrorMessage({ message }: ErrorMessageProps) {
  return (
    <div className="bg-red-950/50 border border-red-900 text-red-400 text-sm rounded-lg px-4 py-3">
      {message}
    </div>
  );
}

