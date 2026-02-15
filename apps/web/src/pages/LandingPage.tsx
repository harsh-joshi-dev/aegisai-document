import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield,
  Brain,
  FileSearch,
  AlertTriangle,
  CheckCircle,
  Zap,
  BarChart3,
  Eye,
  Play,
  Sparkles,
  Database,
  GitBranch,
  Clock,
  Award,
  Users,
  Globe,
  Server,
  ArrowRight,
  Star,
  Quote,
  ChevronDown,
  X,
  User,
} from 'lucide-react';
import './LandingPage.css';

// Animated counter component
function AnimatedCounter({ end, duration = 2, suffix = '' }: { end: number; duration?: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  
  useEffect(() => {
    let startTime: number;
    let animationFrame: number;
    
    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / (duration * 1000), 1);
      setCount(Math.floor(progress * end));
      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };
    
    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [end, duration]);
  
  return <span>{count.toLocaleString()}{suffix}</span>;
}

// Feature Card Component
function FeatureCard({ icon: Icon, title, description, color, delay }: any) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay }}
      whileHover={{ y: -8, scale: 1.02 }}
      className="feature-card-modern"
    >
      <div className={`feature-icon-wrapper ${color}`}>
        <Icon size={28} strokeWidth={1.5} />
      </div>
      <h3 className="feature-title">{title}</h3>
      <p className="feature-description">{description}</p>
    </motion.div>
  );
}

// Risk Signal Demo Component
function RiskSignalDemo() {
  const [activeSignal, setActiveSignal] = useState(0);
  
  const signals = [
    { type: 'critical', label: 'Amount Mismatch', message: 'Invoice ₹1,00,000 ≠ Bank ₹80,000', icon: AlertTriangle },
    { type: 'high', label: 'Missing GST', message: 'Vendor GSTIN not found in document', icon: Shield },
    { type: 'medium', label: 'Pattern Detected', message: 'Repeated amount across vendors', icon: GitBranch },
    { type: 'low', label: 'Time Check', message: 'Document older than 90 days', icon: Clock },
  ];
  
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveSignal((prev) => (prev + 1) % signals.length);
    }, 3000);
    return () => clearInterval(timer);
  }, []);
  
  return (
    <div className="risk-signal-demo">
      <div className="risk-signal-header">
        <div className="risk-badge">
          <Shield size={14} />
          Risk Intelligence
        </div>
        <div className="risk-score">
          <span className="score-value">68</span>
          <span className="score-label">/ 100</span>
        </div>
      </div>
      
      <div className="risk-signals-list">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeSignal}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className={`risk-signal-item ${signals[activeSignal].type}`}
          >
            <div className="signal-icon">
              {(() => {
                const IconComponent = signals[activeSignal].icon;
                return <IconComponent size={20} />;
              })()}
            </div>
            <div className="signal-content">
              <div className="signal-label">{signals[activeSignal].label}</div>
              <div className="signal-message">{signals[activeSignal].message}</div>
            </div>
            <div className={`signal-severity ${signals[activeSignal].type}`}>
              {signals[activeSignal].type}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
      
      <div className="risk-dots">
        {signals.map((_, idx) => (
          <button
            key={idx}
            className={`risk-dot ${idx === activeSignal ? 'active' : ''}`}
            onClick={() => setActiveSignal(idx)}
          />
        ))}
      </div>
    </div>
  );
}

// Video Modal Component
function VideoModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  if (!isOpen) return null;
  
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="video-modal-overlay"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="video-modal-content"
          onClick={(e) => e.stopPropagation()}
        >
          <button className="video-modal-close" onClick={onClose}>
            <X size={24} />
          </button>
          <div className="video-placeholder">
            <div className="video-placeholder-icon">
              <Play size={48} />
            </div>
            <p>Product Demo Video</p>
            <p className="video-placeholder-sub">See Risk Intelligence in action</p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default function LandingPage() {
  const [isVideoOpen, setIsVideoOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const handleLogin = useCallback(() => {
    const backendOrigin = import.meta.env.VITE_BACKEND_URL ||
      (import.meta.env.DEV ? 'http://localhost:3001' : window.location.origin);
    window.location.href = `${backendOrigin}/api/auth/google`;
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const features = [
    {
      icon: Brain,
      title: 'Dynamic Rule Engine V2',
      description: 'Tenant-scoped rules with threshold, required field, consistency, and time-based validations.',
      color: 'blue',
    },
    {
      icon: GitBranch,
      title: 'Pattern Detection V2',
      description: 'Cross-document intelligence detecting repeated amounts, vendor spikes, round payments, and rapid transactions.',
      color: 'purple',
    },
    {
      icon: Shield,
      title: 'Unified Risk Scoring',
      description: 'Standardized RiskSignals with severity weights, confidence scores, and explainable recommendations.',
      color: 'green',
    },
    {
      icon: Eye,
      title: 'Explainable AI',
      description: 'Every risk signal includes what triggered it, why it matters, and what action to take next.',
      color: 'orange',
    },
    {
      icon: Database,
      title: 'Tenant-Scoped Data',
      description: 'Complete data isolation with multi-tenant architecture and RBAC (owner, admin, reviewer, viewer).',
      color: 'indigo',
    },
    {
      icon: Zap,
      title: 'Async Processing',
      description: 'High-performance rule execution with stored results. No recomputation on every request.',
      color: 'yellow',
    },
  ];

  const stats = [
    { value: 99.9, suffix: '%', label: 'Accuracy Rate', icon: TargetIcon },
    { value: 50, suffix: '+', label: 'Rule Types', icon: CheckCircle },
    { value: 1000, suffix: '+', label: 'Documents Processed', icon: FileSearch },
    { value: 10, suffix: 'x', label: 'Faster Review', icon: Zap },
  ];

  function TargetIcon(props: any) {
    return (
      <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <circle cx="12" cy="12" r="6" />
        <circle cx="12" cy="12" r="2" />
      </svg>
    );
  }

  return (
    <div className="landing-page-modern">
      {/* Navigation */}
      <nav className={`landing-nav-modern ${scrolled ? 'scrolled' : ''}`}>
        <div className="landing-nav-container">
          <Link to="/" className="landing-logo-modern">
            <div className="logo-glow">
              <Shield size={28} strokeWidth={2} />
            </div>
            <span className="logo-text">Aegis AI</span>
            <span className="logo-badge">Risk Intelligence</span>
          </Link>
          
          <div className="landing-nav-links">
            <a href="#features" className="nav-link-modern">Features</a>
            <a href="#how-it-works" className="nav-link-modern">How it Works</a>
            <a href="#pricing" className="nav-link-modern">Pricing</a>
            <button onClick={handleLogin} className="nav-link-modern" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>Log In</button>
            <button onClick={handleLogin} className="btn-primary-modern" style={{ border: 'none', cursor: 'pointer' }}>
              Get Started
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="hero-section-modern">
        <div className="hero-bg-effects">
          <div className="hero-glow hero-glow-1"></div>
          <div className="hero-glow hero-glow-2"></div>
          <div className="hero-grid"></div>
        </div>
        
        <div className="hero-container-modern">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="hero-content-modern"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="hero-badge-modern"
            >
              <Sparkles size={16} />
              <span>New: Risk Intelligence System V2</span>
            </motion.div>
            
            <h1 className="hero-title-modern">
              Intelligent Risk Detection
              <br />
              <span className="gradient-text">for Financial Documents</span>
            </h1>
            
            <p className="hero-description-modern">
              Aegis AI's unified Risk Intelligence System combines dynamic rule engines
              with cross-document pattern detection to catch fraud, errors, and compliance
              issues before they cost you money.
            </p>
            
            <div className="hero-cta-modern">
              <button onClick={handleLogin} className="btn-primary-large" style={{ border: 'none', cursor: 'pointer' }}>
                Start Free Trial
                <ArrowRight size={20} />
              </button>
              <button 
                className="btn-video"
                onClick={() => setIsVideoOpen(true)}
              >
                <div className="btn-video-icon">
                  <Play size={16} fill="currentColor" />
                </div>
                Watch Demo
              </button>
            </div>
            
            <div className="hero-trust-modern">
              <div className="trust-avatars">
                <div className="trust-avatar avatar-1">
                  <User size={18} />
                </div>
                <div className="trust-avatar avatar-2">
                  <User size={18} />
                </div>
                <div className="trust-avatar avatar-3">
                  <User size={18} />
                </div>
                <div className="trust-avatar avatar-4">
                  <span>+</span>
                </div>
              </div>
              <div className="trust-rating">
                <div className="trust-stars">
                  {[1,2,3,4,5].map(i => (
                    <Star key={i} size={14} className="trust-star" fill="currentColor" />
                  ))}
                </div>
                <span className="trust-text">Trusted by 500+ audit teams</span>
              </div>
            </div>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, scale: 0.8, rotateY: -15 }}
            animate={{ opacity: 1, scale: 1, rotateY: 0 }}
            transition={{ delay: 0.4, duration: 0.8 }}
            className="hero-visual-modern"
          >
            <RiskSignalDemo />
          </motion.div>
        </div>
        
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 0.5 }}
          className="hero-scroll-indicator"
        >
          <ChevronDown size={24} />
        </motion.div>
      </section>

      {/* Stats Section */}
      <section className="stats-section">
        <div className="stats-container">
          {stats.map((stat, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1 }}
              className="stat-item"
            >
              <div className="stat-icon">
                <stat.icon size={24} />
              </div>
              <div className="stat-value">
                <AnimatedCounter end={stat.value} suffix={stat.suffix} />
              </div>
              <div className="stat-label">{stat.label}</div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="features-section-modern">
        <div className="section-container">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="section-header"
          >
            <div className="section-badge">Features</div>
            <h2 className="section-title">Everything You Need for<br />Document Risk Intelligence</h2>
            <p className="section-description">
              From dynamic rule engines to cross-document pattern detection,
              Aegis AI provides complete risk visibility.
            </p>
          </motion.div>
          
          <div className="features-grid-modern">
            {features.map((feature, idx) => (
              <FeatureCard key={idx} {...feature} delay={idx * 0.1} />
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="how-it-works-section">
        <div className="section-container">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="section-header"
          >
            <div className="section-badge">Process</div>
            <h2 className="section-title">How Risk Intelligence Works</h2>
            <p className="section-description">
              Our unified system processes documents through multiple intelligence layers
            </p>
          </motion.div>
          
          <div className="process-steps">
            {[
              {
                step: '01',
                title: 'Document Ingestion',
                description: 'Upload invoices, bank statements, contracts, and financial documents. Multi-format support with OCR.',
                icon: FileSearch,
              },
              {
                step: '02',
                title: 'Dynamic Rule Execution',
                description: 'Tenant-scoped rules validate thresholds, required fields, consistency checks, and time constraints.',
                icon: Brain,
              },
              {
                step: '03',
                title: 'Pattern Detection',
                description: 'Cross-document analysis detects repeated amounts, vendor frequency spikes, and suspicious patterns.',
                icon: GitBranch,
              },
              {
                step: '04',
                title: 'Risk Aggregation',
                description: 'All signals are aggregated into a unified risk score with severity-weighted calculations.',
                icon: BarChart3,
              },
            ].map((item, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, x: idx % 2 === 0 ? -30 : 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.15 }}
                className="process-step"
              >
                <div className="step-number">{item.step}</div>
                <div className="step-content">
                  <div className="step-icon">
                    <item.icon size={24} />
                  </div>
                  <h3 className="step-title">{item.title}</h3>
                  <p className="step-description">{item.description}</p>
                </div>
                {idx < 3 && <div className="step-connector" />}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Risk Signal Types */}
      <section className="risk-types-section">
        <div className="section-container">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="section-header"
          >
            <div className="section-badge">Risk Signals</div>
            <h2 className="section-title">Comprehensive Risk Detection</h2>
          </motion.div>
          
          <div className="risk-types-grid">
            {[
              { type: 'Rule Violations', count: '4 Types', desc: 'Threshold, Required, Consistency, Time', color: 'blue', icon: Shield },
              { type: 'Pattern Detection', count: '4 Patterns', desc: 'Repeated Amounts, Vendor Spike, Round Payments, Rapid TX', color: 'purple', icon: GitBranch },
              { type: 'Missing Fields', count: 'Custom', desc: 'Configurable required field validation', color: 'orange', icon: FileSearch },
              { type: 'Mismatches', count: 'Real-time', desc: 'Cross-document amount and data validation', color: 'red', icon: AlertTriangle },
            ].map((risk, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                className={`risk-type-card ${risk.color}`}
              >
                <div className="risk-type-icon">
                  <risk.icon size={24} />
                </div>
                <div className="risk-type-header">
                  <span className="risk-type-name">{risk.type}</span>
                  <span className="risk-type-count">{risk.count}</span>
                </div>
                <p className="risk-type-desc">{risk.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="testimonials-section">
        <div className="section-container">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="section-header"
          >
            <div className="section-badge">Testimonials</div>
            <h2 className="section-title">Trusted by Audit Professionals</h2>
          </motion.div>
          
          <div className="testimonials-grid">
            {[
              {
                quote: "The Risk Intelligence System caught a ₹50L duplicate payment that our manual review missed. The pattern detection across vendors is game-changing.",
                author: "Rajesh Kumar",
                role: "Partner, Big Four Firm",
                location: "Mumbai",
              },
              {
                quote: "We reduced our document review time by 80%. The explainable AI feature helps our junior staff understand why something is flagged.",
                author: "Priya Sharma",
                role: "CA, Mid-size Practice",
                location: "Delhi",
              },
              {
                quote: "The tenant-scoped rules let us configure different risk profiles for each client. Multi-tenancy with data isolation is exactly what we needed.",
                author: "Amit Patel",
                role: "CFO, Manufacturing Co",
                location: "Ahmedabad",
              },
            ].map((testimonial, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.15 }}
                className="testimonial-card"
              >
                <Quote size={32} className="testimonial-quote-icon" />
                <p className="testimonial-quote">{testimonial.quote}</p>
                <div className="testimonial-author">
                  <div className="testimonial-avatar">
                    {testimonial.author.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div className="testimonial-info">
                    <div className="testimonial-name">{testimonial.author}</div>
                    <div className="testimonial-role">{testimonial.role}</div>
                    <div className="testimonial-location">{testimonial.location}</div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta-section-modern">
        <div className="cta-bg-effects">
          <div className="cta-glow cta-glow-1"></div>
          <div className="cta-glow cta-glow-2"></div>
        </div>
        
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="cta-container"
        >
          <h2 className="cta-title">Ready to Transform Your<br />Document Risk Management?</h2>
          <p className="cta-description">
            Join 500+ audit teams using Aegis AI's Risk Intelligence System
to catch errors before they become costly mistakes.
          </p>
          
          <div className="cta-buttons">
            <button onClick={handleLogin} className="btn-primary-large" style={{ border: 'none', cursor: 'pointer' }}>
              Start Free Trial
              <ArrowRight size={20} />
            </button>
            <button onClick={handleLogin} className="btn-secondary-large" style={{ border: 'none', cursor: 'pointer' }}>
              Schedule Demo
            </button>
          </div>
          
          <div className="cta-features">
            {['No credit card required', '14-day free trial', 'Cancel anytime'].map((feature, idx) => (
              <div key={idx} className="cta-feature">
                <CheckCircle size={16} />
                <span>{feature}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="landing-footer-modern">
        <div className="footer-container">
          <div className="footer-brand">
            <div className="footer-logo">
              <Shield size={24} />
              <span>Aegis AI</span>
            </div>
            <p className="footer-tagline">
              Intelligent Risk Detection for Financial Documents
            </p>
            <div className="footer-social">
              {[Globe, Server, Users, Award].map((Icon, idx) => (
                <a key={idx} href="#" className="social-link">
                  <Icon size={18} />
                </a>
              ))}
            </div>
          </div>
          
          <div className="footer-links">
            <div className="footer-column">
              <h4>Product</h4>
              <a href="#features">Features</a>
              <a href="#pricing">Pricing</a>
              <button onClick={handleLogin} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, font: 'inherit' }}>Get Started</button>
            </div>
            <div className="footer-column">
              <h4>Company</h4>
              <Link to="/contact">Contact</Link>
              <Link to="/privacy">Privacy</Link>
              <Link to="/terms">Terms</Link>
            </div>
            <div className="footer-column">
              <h4>Support</h4>
              <a href="#">Documentation</a>
              <a href="#">API Reference</a>
              <a href="#">Status</a>
            </div>
          </div>
        </div>
        
        <div className="footer-bottom">
          <p>© 2024 Aegis AI. All rights reserved.</p>
          <p className="footer-built">Built for the future of audit intelligence</p>
        </div>
      </footer>

      {/* Video Modal */}
      <VideoModal isOpen={isVideoOpen} onClose={() => setIsVideoOpen(false)} />
    </div>
  );
}
