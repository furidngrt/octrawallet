import { CopyButton } from './CopyButton';

interface StatsCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  copyText?: string;
}

export function StatsCard({ label, value, subValue, copyText }: StatsCardProps) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value">
        {value}
        {subValue && <span className="stat-sub">{subValue}</span>}
        {copyText && (
          <span className="stat-copy-wrapper">
            <CopyButton text={copyText} className="stat-copy-btn" />
          </span>
        )}
      </div>
    </div>
  );
}

