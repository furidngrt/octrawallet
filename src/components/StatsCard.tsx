interface StatsCardProps {
  label: string;
  value: string;
  subValue?: string;
  onCopy?: () => void;
  copyable?: boolean;
}

export function StatsCard({ label, value, subValue, onCopy, copyable }: StatsCardProps) {
  const handleCopy = () => {
    if (copyable && onCopy) {
      onCopy();
    } else if (copyable) {
      navigator.clipboard.writeText(value);
    }
  };

  return (
    <div className="stat-card">
      <div className="stat-card-label">{label}</div>
      <div className="stat-card-value" style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)' }}>
        <span className={copyable ? 'truncate' : ''} style={{ flex: 1 }}>{value}</span>
        {copyable && (
          <button onClick={handleCopy} className="copy-button" title="Copy to clipboard">
            📋
          </button>
        )}
      </div>
      {subValue && <div className="stat-card-sub">{subValue}</div>}
    </div>
  );
}
