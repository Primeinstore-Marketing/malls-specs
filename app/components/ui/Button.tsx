import Link from 'next/link';
import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost';

const VARIANT: Record<Variant, string> = {
  primary: 'bg-accent text-fg-on-accent hover:bg-accent-hover active:bg-accent-active border border-transparent',
  secondary: 'bg-bg text-fg border border-border-strong hover:bg-bg-subtle',
  ghost: 'bg-transparent text-fg-muted border border-transparent hover:bg-bg-subtle hover:text-fg',
};

const BASE =
  'inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-body-sm font-medium transition-colors duration-fast ease-standard disabled:cursor-not-allowed disabled:opacity-50';

export function Button({
  variant = 'secondary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button className={`${BASE} ${VARIANT[variant]} ${className}`} {...props} />;
}

export function LinkButton({
  variant = 'secondary',
  className = '',
  href,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & { variant?: Variant; href: string }) {
  return <Link href={href} className={`${BASE} ${VARIANT[variant]} ${className}`} {...props} />;
}
