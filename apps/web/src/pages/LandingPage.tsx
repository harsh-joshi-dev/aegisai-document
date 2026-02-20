import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';
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
  Lock,
  Layers,
  Activity,
  Search,
  Check,
  Building2,
  FileText,
  Workflow,
  ShieldCheck,
  ChevronRight,
  Mail,
  Linkedin,
  Twitter,
  Github
} from 'lucide-react';
import { Logo } from '../components/ui/Logo';
import { BrandIcon } from '../components/ui/BrandIcon';
import './LandingPage.css';

// Animated counter component
function AnimatedCounter({ end, duration = 2, suffix = '' }: { end: number; duration?: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  const nodeRef = useRef(null);

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

  return <span ref={nodeRef}>{count.toLocaleString()}{suffix}</span>;
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
      <div className="risk-glare"></div>
      <div className="risk-signal-header">
        <div className="risk-badge">
          <BrandIcon size={14} className="mr-1" />
          <span>Risk Intelligence V2.6</span>
        </div>
        <div className="risk-status">
          <div className="status-dot"></div>
          <span>Live Monitoring</span>
        </div>
      </div>

      <div className="risk-analysis-view">
        <div className="risk-score-circle">
          <svg viewBox="0 0 36 36" className="circular-chart">
            <path className="circle-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
            <path className="circle" strokeDasharray="68, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
            <text x="18" y="20.35" className="percentage">68</text>
            <text x="18" y="26" className="score-lbl">Risk Score</text>
          </svg>
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
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <div className="risk-mini-stats">
        <div className="mini-stat">
          <span className="mini-label">Accuracy</span>
          <span className="mini-value">99.8%</span>
        </div>
        <div className="mini-stat">
          <span className="mini-label">Scan Speed</span>
          <span className="mini-value">250ms</span>
        </div>
      </div>
    </div>
  );
}

// FAQ Component
function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={`faq-item ${isOpen ? 'open' : ''}`} onClick={() => setIsOpen(!isOpen)}>
      <div className="faq-question">
        <span>{question}</span>
        <ChevronDown size={20} className="faq-icon" />
      </div>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="faq-answer"
          >
            <p>{answer}</p>
          </motion.div>
        )}
      </AnimatePresence>
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
          <div className="video-viewport">
            {/* Using a sophisticated placeholder design for the demo video */}
            <div className="demo-video-interface">
              <div className="demo-sidebar">
                <div className="demo-logo">AA</div>
                <div className="demo-nav-item active"></div>
                <div className="demo-nav-item"></div>
                <div className="demo-nav-item"></div>
              </div>
              <div className="demo-main">
                <div className="demo-header">
                  <div className="demo-search"></div>
                  <div className="demo-avatar"></div>
                </div>
                <div className="demo-content">
                  <div className="demo-grid">
                    <div className="demo-card skeleton-pulse"></div>
                    <div className="demo-card skeleton-pulse"></div>
                    <div className="demo-card skeleton-pulse"></div>
                  </div>
                  <div className="demo-big-card skeleton-pulse"></div>
                </div>
                <div className="demo-floating-action">
                  <Play size={32} />
                  <span>Click to Play Demo</span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default function LandingPage() {
  const [isVideoOpen, setIsVideoOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const heroRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"]
  });

  const y = useTransform(scrollYProgress, [0, 1], [0, 200]);
  const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);

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
      title: 'Neural Rule Engine',
      description: 'Advanced heuristic analysis combined with machine learning to identify complex document irregularities in milliseconds.',
      color: 'blue',
    },
    {
      icon: Layers,
      title: 'Multi-layer Validation',
      description: 'Cross-reference data against historical records, industry benchmarks, and 3rd party blacklists for 360° protection.',
      color: 'purple',
    },
    {
      icon: ShieldCheck,
      title: 'Bank-Grade Security',
      description: 'SOC2 Type II compliant infrastructure with end-to-end AES-256 encryption for all processed financial metadata.',
      color: 'green',
    },
    {
      icon: Activity,
      title: 'Real-time Intelligence',
      description: 'Continuous monitoring of transaction streams with instant alerts for suspicious spikes or pattern deviations.',
      color: 'orange',
    },
    {
      icon: Workflow,
      title: 'Enterprise Workflows',
      description: 'Role-based access controls and custom approval chains designed for large-scale financial audit teams.',
      color: 'indigo',
    },
    {
      icon: Database,
      title: 'Data Sovereignty',
      description: 'Tenant-isolated databases and multi-cloud deployment options to meet strict regulatory data residency requirements.',
      color: 'yellow',
    },
  ];

  const stats = [
    { value: 99.9, suffix: '%', label: 'Detection Accuracy', icon: Activity },
    { value: 120, suffix: 'B+', label: 'Volume Scanned', icon: BarChart3 },
    { value: 50, suffix: 'ms', label: 'Average Latency', icon: Zap },
    { value: 500, suffix: '+', label: 'Global Enterprises', icon: Building2 },
  ];

  return (
    <div className="landing-page-modern">
      {/* Background Ambience */}
      <div className="fixed-ambience">
        <div className="glow-orb orb-1"></div>
        <div className="glow-orb orb-2"></div>
      </div>

      {/* Navigation */}
      <nav className={`landing-nav-modern ${scrolled ? 'scrolled' : ''}`}>
        <div className="landing-nav-container">
          <Link to="/" className="landing-logo-modern">
            <Logo size="sm" />
          </Link>

          <div className="landing-nav-links lg:flex hidden">
            <a href="#solutions" className="nav-link-modern">Solutions</a>
            <a href="#features" className="nav-link-modern">Platform</a>
            <a href="#security" className="nav-link-modern">Security</a>
            <a href="#pricing" className="nav-link-modern">Pricing</a>
          </div>

          <div className="landing-nav-actions">
            <button onClick={handleLogin} className="nav-link-modern login-btn">Log In</button>
            <button onClick={handleLogin} className="btn-primary-modern">
              <span>Book a Demo</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section ref={heroRef} className="hero-section-modern">
        <div className="hero-grid-overlay"></div>

        <div className="hero-container-modern">
          <motion.div
            style={{ y, opacity }}
            className="hero-content-modern"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="hero-badge-enterprise"
            >
              <div className="badge-pulse"></div>
              <span>Trusted by Fortune 500 Risk Teams</span>
            </motion.div>

            <h1 className="hero-title-max">
              Empowering Integrity in
              <span className="gradient-text"> Enterprise Finance</span>
            </h1>

            <p className="hero-description-max">
              The only AI-driven risk intelligence platform designed specifically for
              multi-national document auditing, fraud prevention, and real-time compliance.
            </p>

            <div className="hero-cta-group">
              <button onClick={handleLogin} className="btn-primary-xl">
                Get Started
                <ArrowRight size={20} />
              </button>
              <button
                className="btn-video-outline"
                onClick={() => setIsVideoOpen(true)}
              >
                <div className="video-icon">
                  <Play size={14} fill="currentColor" />
                </div>
                See Platform Tour
              </button>
            </div>

            <div className="hero-social-proof">
              <p>INTEGRATES WITH YOUR STACK</p>
              <div className="integration-logos">
                <span className="logo-box">SAP</span>
                <span className="logo-box">Oracle</span>
                <span className="logo-box">Workday</span>
                <span className="logo-box">NetSuite</span>
                <span className="logo-box">Azure</span>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 1 }}
            className="hero-dash-preview"
          >
            <div className="dash-mockup">
              <RiskSignalDemo />
              <div className="dash-decor-1"></div>
              <div className="dash-decor-2"></div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Trust Ticker */}
      <div className="trust-ticker-container">
        <div className="ticker-label">Used by 200+ global brands</div>
        <div className="ticker-track">
          {[1, 2, 3, 4, 5, 6, 1, 2, 3, 4, 5, 6].map((i, idx) => (
            <div key={idx} className="ticker-item">
              <Building2 size={20} />
              <span>GLOBAL CORPORATE {i}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Stats Section */}
      <section className="stats-modern">
        <div className="section-container">
          <div className="stats-grid-modern">
            {stats.map((stat, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                className="stat-card-enterprise"
              >
                <div className="stat-icon-box">
                  <stat.icon size={20} />
                </div>
                <div className="stat-main">
                  <div className="stat-v">
                    <AnimatedCounter end={stat.value} suffix={stat.suffix} />
                  </div>
                  <div className="stat-l">{stat.label}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Solutions / Industry */}
      <section id="solutions" className="solutions-section">
        <div className="section-container">
          <div className="section-header-left">
            <h2 className="section-title-huge">Enterprise Solutions</h2>
            <p className="section-subtitle">Tailored intelligence for your industry needs.</p>
          </div>

          <div className="solutions-grid">
            <div className="solution-card">
              <div className="solution-visual finserv"></div>
              <div className="solution-info">
                <h3>Financial Services</h3>
                <p>Automate KYC/AML document verification and transaction auditing at scale.</p>
                <ul className="solution-list">
                  <li><Check size={16} /> Credit Risk Assessment</li>
                  <li><Check size={16} /> Regulatory Reporting (SEC, FINRA)</li>
                  <li><Check size={16} /> Anti-Money Laundering</li>
                </ul>
              </div>
            </div>
            <div className="solution-card">
              <div className="solution-visual healthcare"></div>
              <div className="solution-info">
                <h3>Manufacturing & Supply</h3>
                <p>Monitor vendor spending and invoice patterns across complex supply chains.</p>
                <ul className="solution-list">
                  <li><Check size={16} /> Dynamic Vendor Audits</li>
                  <li><Check size={16} /> Duplicate Payment Prevention</li>
                  <li><Check size={16} /> Procurement Integrity</li>
                </ul>
              </div>
            </div>
            <div className="solution-card">
              <div className="solution-visual retail"></div>
              <div className="solution-info">
                <h3>Professional Services</h3>
                <p>Streamline document review for audit, tax, and advisory engagements.</p>
                <ul className="solution-list">
                  <li><Check size={16} /> Workflow Automation</li>
                  <li><Check size={16} /> Explainable AI Insights</li>
                  <li><Check size={16} /> Client Data Isolation</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Detail */}
      <section id="features" className="features-enterprise">
        <div className="section-container">
          <div className="features-layout">
            <div className="features-text">
              <div className="section-badge-modern">The Platform</div>
              <h2 className="section-title-xl">Intelligent Infrastructure for Modern Finance</h2>
              <div className="features-accordion">
                {features.map((f, i) => (
                  <motion.div
                    key={i}
                    whileHover={{ x: 10 }}
                    className="feature-row"
                  >
                    <div className={`feature-dot ${f.color}`}></div>
                    <div className="feature-row-content">
                      <h4>{f.title}</h4>
                      <p>{f.description}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
            <div className="features-visual">
              <div className="visual-stack">
                <div className="v-card v-card-1">
                  <Activity size={32} className="v-icon" />
                  <div className="v-graph"></div>
                </div>
                <div className="v-card v-card-2">
                  <BrandIcon size={32} />
                  <div className="v-text-cols">
                    <div className="v-col"></div>
                    <div className="v-col"></div>
                  </div>
                </div>
                <div className="v-card v-card-3">
                  <Database size={32} className="v-icon" />
                  <div className="v-nodes"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Security Section */}
      <section id="security" className="security-premium">
        <div className="security-bg"></div>
        <div className="section-container">
          <div className="security-inner">
            <div className="security-icon-main">
              <Lock size={48} />
            </div>
            <h2 className="security-title">Security is our DNA</h2>
            <p className="security-text">
              CA.Dynamix is built on a Zero-Trust architecture. We prioritize the safety of your
              financial data with rigorous compliance standards and independent audits.
            </p>
            <div className="security-badges">
              <div className="sec-badge">
                <Shield size={24} />
                <span>SOC2 Type II</span>
              </div>
              <div className="sec-badge">
                <Globe size={24} />
                <span>GDPR Compliant</span>
              </div>
              <div className="sec-badge">
                <FileText size={24} />
                <span>ISO 27001</span>
              </div>
              <div className="sec-badge">
                <Database size={24} />
                <span>AES-256 Encrypted</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="testimonials-modern">
        <div className="section-container">
          <div className="testimonials-header">
            <div className="testimonials-label">Global Feedback</div>
            <h2>What Industry Leaders Say</h2>
          </div>

          <div className="testimonials-river">
            {[
              {
                text: "CA.Dynamix revolutionized our audit process. We've seen a 40% increase in fraud detection accuracy since implementation.",
                author: "Sarah Jenkins",
                role: "Director of Audit",
                company: "Fortis Group"
              },
              {
                text: "The explainable AI feature is a game-changer for our compliance team. Every flag is actionable and transparent.",
                author: "Marcus Chen",
                role: "VP of Risk",
                company: "Nexis Financial"
              },
              {
                text: "Scaling our document review was a bottleneck until we integrated CA.Dynamix. Now we process millions of documents monthly.",
                author: "Elena Rossi",
                role: "CFO",
                company: "Global Logistics"
              }
            ].map((t, i) => (
              <div key={i} className="testimonial-card-premium">
                <Quote className="quote-icon" />
                <p>{t.text}</p>
                <div className="testimonial-footer">
                  <div className="t-avatar">{t.author[0]}</div>
                  <div className="t-meta">
                    <span className="t-name">{t.author}</span>
                    <span className="t-comp">{t.role}, {t.company}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="faq-section-modern">
        <div className="section-container">
          <div className="faq-container">
            <div className="faq-sidebar">
              <h2>Common Questions</h2>
              <p>Everything you need to know about CA.Dynamix for your enterprise.</p>
              <button className="contact-link">
                <span>Talk to Sales</span>
                <ChevronRight size={16} />
              </button>
            </div>
            <div className="faq-list">
              <FAQItem
                question="How does CA.Dynamix handle data privacy?"
                answer="We use tenant-isolated databases and end-to-end encryption. Your data is never used to train global models without explicit consent, and we support on-premise or private cloud deployments."
              />
              <FAQItem
                question="Can we integrate with legacy ERP systems?"
                answer="Yes, CA.Dynamix offers a robust REST API and pre-built connectors for SAP, Oracle, Workday, and Microsoft Dynamics, allowing for seamless data ingestion."
              />
              <FAQItem
                question="What is the average implementation time?"
                answer="A typical enterprise deployment takes 2-4 weeks, including custom rule configuration, system integration, and team onboarding."
              />
              <FAQItem
                question="How accurate is the risk detection?"
                answer="Our platform averages 99.9% accuracy on standard document types. Our 'Explainable AI' provides the reasoning behind every flag, allowing humans to verify insights easily."
              />
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="final-cta">
        <div className="cta-overlay"></div>
        <div className="section-container">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="cta-content-enterprise"
          >
            <h2 className="cta-title-xl">Start Your Financial Compliance Transformation</h2>
            <p className="cta-subtitle">Join the leading enterprises securing their future with CA.Dynamix.</p>
            <div className="cta-actions">
              <button onClick={handleLogin} className="btn-primary-xxl">Schedule a Personal Demo</button>
              <button onClick={handleLogin} className="btn-ghost-xxl">View Pricing Plans</button>
            </div>
            <div className="cta-trust">
              <CheckCircle size={14} /> <span>14-Day Free Evaluation</span>
              <CheckCircle size={14} /> <span>Full Security Assessment</span>
              <CheckCircle size={14} /> <span>Dedicated Account Manager</span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer-enterprise">
        <div className="section-container">
          <div className="footer-top">
            <div className="footer-brand-huge">
              <div className="footer-logo-main">
                <Logo size="md" />
              </div>
              <p>Securing the world's most sensitive financial workflows with intelligent risk detection.</p>
              <div className="footer-social-links">
                <a href="#"><Linkedin size={20} /></a>
                <a href="#"><Twitter size={20} /></a>
                <a href="#"><Github size={20} /></a>
              </div>
            </div>

            <div className="footer-links-grid">
              <div className="footer-col">
                <h4>Platform</h4>
                <a href="#">Overview</a>
                <a href="#">Security</a>
                <a href="#">Integrations</a>
                <a href="#">Roadmap</a>
              </div>
              <div className="footer-col">
                <h4>Solutions</h4>
                <a href="#">Financial Services</a>
                <a href="#">Manufacturing</a>
                <a href="#">Public Sector</a>
                <a href="#">Partners</a>
              </div>
              <div className="footer-col">
                <h4>Company</h4>
                <a href="#">About Us</a>
                <a href="#">Careers</a>
                <a href="#">Newsroom</a>
                <a href="#">Contact</a>
              </div>
              <div className="footer-col">
                <h4>Resources</h4>
                <a href="#">Documentation</a>
                <a href="#">API Status</a>
                <a href="#">Case Studies</a>
                <a href="#">Blog</a>
              </div>
            </div>
          </div>

          <div className="footer-bottom-enterprise">
            <div className="footer-legal">
              <span>© 2026 CA.Dynamix Intelligence Inc.</span>
              <Link to="/privacy">Privacy Policy</Link>
              <Link to="/terms">Terms of Service</Link>
              <a href="#">Cookie Settings</a>
            </div>
            <div className="footer-status">
              <div className="status-indicator"></div>
              <span>All Systems Operational</span>
            </div>
          </div>
        </div>
      </footer>

      {/* Video Modal */}
      <VideoModal isOpen={isVideoOpen} onClose={() => setIsVideoOpen(false)} />
    </div>
  );
}
