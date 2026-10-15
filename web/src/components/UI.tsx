import type { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  /** Define o elemento semântico do card (ex: 'section', 'article'). */
  as?: 'div' | 'section' | 'article' | 'li';
}

export function Card({ children, className = '', as: Tag = 'div' }: CardProps) {
  return <Tag className={`card ${className}`}>{children}</Tag>;
}

interface StatCardProps {
  label: string;
  value: number | string;
  sub?: string;
  /** Valor de tendência em % (positivo sobe, negativo desce). Exibe seta + cor. */
  trend?: number;
}

export function StatCard({ label, value, sub, trend }: StatCardProps) {
  return (
    <Card className="flex flex-col gap-1.5">
      <span className="text-xs text-ink-faint uppercase tracking-wider">{label}</span>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-semibold text-ink-strong tabular-nums">{value}</span>
        {trend !== undefined && (
          <span
            className={`text-xs font-medium ${trend >= 0 ? 'text-green-400' : 'text-red-400'}`}
          >
            {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%
          </span>
        )}
      </div>
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
      className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${badgeColors[color]}`}
    >
      {children}
    </span>
  );
}

interface SpinnerProps {
  label?: string;
  size?: 'sm' | 'md';
}

export function Spinner({ label, size = 'md' }: SpinnerProps) {
  const dim = size === 'sm' ? 'w-4 h-4' : 'w-6 h-6';
  return (
    <div
      className="flex flex-col items-center justify-center py-12 gap-3 text-ink-base text-sm"
      role="status"
      aria-live="polite"
    >
      <span className={`spinner-ring ${dim}`} aria-hidden="true" />
      {label && <span>{label}</span>}
    </div>
  );
}

/** Bloco de carregamento com a forma aproximada do conteúdo final. */
export function Skeleton({
  className = '',
  lines = 1,
}: {
  className?: string;
  lines?: number;
}) {
  if (lines <= 1) {
    return <div className={`skeleton h-4 w-full ${className}`} aria-hidden="true" />;
  }
  return (
    <div className="flex flex-col gap-2" aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={`skeleton h-4 ${i === lines - 1 ? 'w-2/3' : 'w-full'} ${className}`}
        />
      ))}
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
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-center animate-fade-up">
      <div
        className="w-12 h-12 rounded-full bg-surface-hover flex items-center justify-center text-ink-faint text-xl mb-1"
        aria-hidden="true"
      >
        ◇
      </div>
      <p className="text-ink-strong font-medium">{title}</p>
      {description && <p className="text-ink-base text-sm max-w-sm">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

interface ErrorMessageProps {
  message: string;
  /** Ação opcional (ex: botão "Tentar novamente"). */
  action?: ReactNode;
}

export function ErrorMessage({ message, action }: ErrorMessageProps) {
  return (
    <div
      className="bg-red-950/50 border border-red-900 text-red-400 text-sm rounded-lg px-4 py-3 flex items-start justify-between gap-3 animate-fade-up"
      role="alert"
    >
      <span>{message}</span>
      {action && <span className="shrink-0">{action}</span>}
    </div>
  );
}
