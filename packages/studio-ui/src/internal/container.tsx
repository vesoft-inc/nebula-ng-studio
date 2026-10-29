import type { CSSProperties, ReactNode } from 'react';

export function WorkbenchContainer({
  children,
  className,
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div className={className} style={{ height: '100%', minHeight: 0, minWidth: 0, ...style }}>
      {children}
    </div>
  );
}
