import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { featuresByCategory, type NavCategory, type NavFeature } from '../config/featuresByCategory';
import './CategoryNav.css';

export default function CategoryNav() {
  const [openCategoryId, setOpenCategoryId] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const navRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();

  // Close on route change (e.g. after clicking a feature)
  useEffect(() => {
    setOpenCategoryId(null);
    setIsOpen(false);
  }, [location.pathname, location.search]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setOpenCategoryId(null);
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCategoryEnter = (cat: NavCategory) => {
    setOpenCategoryId(cat.id);
    setIsOpen(true);
  };

  const handleCategoryLeave = () => {
    setOpenCategoryId(null);
  };

  const handleFeatureClick = (f: NavFeature) => {
    if (f.type === 'page' && f.path) {
      navigate(f.path);
      setOpenCategoryId(null);
      setIsOpen(false);
      return;
    }
    if (f.type === 'feature') {
      navigate(`/?feature=${f.id}`);
      setOpenCategoryId(null);
      setIsOpen(false);
    }
  };

  const handleToggleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (openCategoryId) {
      setOpenCategoryId(null);
      setIsOpen(false);
    } else {
      setOpenCategoryId(featuresByCategory[0]?.id ?? null);
      setIsOpen(true);
    }
  };

  return (
    <div className="category-nav" ref={navRef}>
      <button
        type="button"
        className="category-nav-trigger"
        onClick={handleToggleClick}
        onMouseEnter={() => featuresByCategory[0] && handleCategoryEnter(featuresByCategory[0])}
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label="Features by category"
      >
        Features
        <span className="category-nav-chevron" aria-hidden>▼</span>
      </button>

      {isOpen && (
        <div
          className="category-nav-mega"
          onMouseLeave={handleCategoryLeave}
          role="menu"
        >
          <div className="category-nav-mega-inner">
            <div className="category-nav-categories">
              {featuresByCategory.map((cat) => (
                <div
                  key={cat.id}
                  className={`category-nav-cat ${openCategoryId === cat.id ? 'active' : ''}`}
                  onMouseEnter={() => handleCategoryEnter(cat)}
                  role="none"
                >
                  <span className="category-nav-cat-label" role="menuitem">{cat.label}</span>
                </div>
              ))}
            </div>
            <div className="category-nav-features-panel">
              {openCategoryId && (() => {
                const cat = featuresByCategory.find((c) => c.id === openCategoryId);
                if (!cat) return null;
                return (
                  <ul className="category-nav-features-list" role="group" aria-label={cat.label}>
                    {cat.features.map((f) => (
                      <li key={`${cat.id}-${f.id}`} role="none">
                        <button
                          type="button"
                          className="category-nav-feature-btn"
                          onClick={() => handleFeatureClick(f)}
                          role="menuitem"
                        >
                          {f.label}
                        </button>
                      </li>
                    ))}
                  </ul>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
