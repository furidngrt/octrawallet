import { Link, useLocation } from 'react-router-dom';

interface NavigationProps {
  activeTab: string;
}

export function Navigation({}: NavigationProps) {
  const location = useLocation();

  return (
    <nav className="top-nav">
      <ul className="nav-list">
        <li>
          <Link
            to="/"
            className={`nav-tab ${location.pathname === '/' ? 'active' : ''}`}
          >
            Wallet
          </Link>
        </li>
        <li>
          <Link
            to="/Transactions"
            className={`nav-tab ${location.pathname === '/Transactions' ? 'active' : ''}`}
          >
            Transactions
          </Link>
        </li>
      </ul>
    </nav>
  );
}

