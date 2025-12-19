import { CopyButton } from './CopyButton';

const DONATE_ADDRESS = 'oct72n9vmcqvgCH77UvHdsFaZC4RhMT9NnqFJkqMNk5MVFb';

export function Footer() {
  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 5)}..${addr.slice(-5)}`;
  };

  return (
    <footer className="app-footer">
      <div className="footer-content">
        <span className="footer-label">Donate:</span>
        <span className="footer-address">{formatAddress(DONATE_ADDRESS)}</span>
        <CopyButton text={DONATE_ADDRESS} className="footer-copy-btn" />
      </div>
    </footer>
  );
}
