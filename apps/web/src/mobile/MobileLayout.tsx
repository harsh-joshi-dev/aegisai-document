import { Outlet } from 'react-router-dom';
import MobileNav from './MobileNav';
import './mobile.css';

export default function MobileLayout() {
  return (
    <div className="m-app">
      <div className="m-content">
        <Outlet />
      </div>
      <MobileNav />
    </div>
  );
}

