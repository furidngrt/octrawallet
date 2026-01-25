import { NavLink } from 'react-router-dom';

export function Navigation() {
  return (
    <nav className="nav-tabs">
      <div className="nav-tabs-container">
        <NavLink
          to="/"
          className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          end
        >
          <span className="nav-icon">📊</span>
          browse
        </NavLink>
        <NavLink
          to="/Transactions"
          className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
        >
          <span className="nav-icon">📋</span>
          transactions
        </NavLink>
      </div>
    </nav>
  );
}
