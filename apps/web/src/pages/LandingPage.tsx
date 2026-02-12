import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { featuresByCategory } from '../config/featuresByCategory';
import './LandingPage.css';

// Hook for scroll animations
const useScrollReveal = () => {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
          }
        });
      },
      { threshold: 0.1 }
    );

    document.querySelectorAll('.reveal').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);
};

export default function LandingPage() {
  const { } = useAuth();
  const navigate = useNavigate();
  useScrollReveal();

  const handleGetStarted = () => {
    navigate('/login');
  };

  const [activeTab, setActiveTab] = useState('upload');
  const [activeFaq, setActiveFaq] = useState<number | null>(null);
  const [currentSlide, setCurrentSlide] = useState(0);

  const toggleFaq = (index: number) => {
    setActiveFaq(activeFaq === index ? null : index);
  };

  // Image slider data — India SME Lending
  const sliderImages = [
    {
      title: 'ULI Document Fetch',
      description: 'GST returns, ITR, bank statements & Aadhaar with consent-based access',
      image: '📄'
    },
    {
      title: 'Consistency Score & Risk Flags',
      description: 'GST vs ITR revenue mismatch, employment continuity, bank velocity rules',
      image: '📊'
    },
    {
      title: 'Due Diligence Report',
      description: 'NBFC-ready credit committee report: Approve / Review / Decline',
      image: '📋'
    },
    {
      title: 'DPDP Compliance',
      description: 'Immutable consent logs, 90-day auto-deletion, data principal rights',
      image: '🔒'
    },
    {
      title: 'Indic Language OCR',
      description: 'Hindi, Gujarati, Tamil & more — Sarvam AI vision for regional documents',
      image: '🌐'
    }
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % sliderImages.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [sliderImages.length]);

  // Animate stats numbers
  useEffect(() => {
    const animateNumbers = () => {
      const statNumbers = document.querySelectorAll('.stat-number');
      statNumbers.forEach((stat) => {
        const target = parseInt(stat.getAttribute('data-target') || '0');
        const duration = 2000;
        const increment = target / (duration / 16);
        let current = 0;

        const updateNumber = () => {
          current += increment;
          if (current < target) {
            stat.textContent = Math.floor(current).toString();
            requestAnimationFrame(updateNumber);
          } else {
            stat.textContent = target.toString();
          }
        };

        const observer = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (entry.isIntersecting && !stat.classList.contains('animated')) {
                stat.classList.add('animated');
                updateNumber();
                observer.unobserve(stat);
              }
            });
          },
          { threshold: 0.5 }
        );

        observer.observe(stat);
      });
    };

    animateNumbers();
  }, []);

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % sliderImages.length);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + sliderImages.length) % sliderImages.length);
  };

  return (
    <div className="landing-page">
      {/* Navigation Header */}
      <nav className="landing-nav glass-nav">
        <div className="landing-nav-container">
          <div className="landing-logo">
            <div className="logo-box">
              <svg className="logo-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M9 12l2 2 4-4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <span className="font-tracking-tight">Aegis AI</span>
          </div>
          <div className="landing-nav-links">
            <a href="#features" className="nav-link">Features</a>
            <a href="#how-it-works" className="nav-link">How it Works</a>
            <Link to="/pricing" className="nav-link">Pricing (INR)</Link>
            <a href="#security" className="nav-link">Security & DPDP</a>
            <a href="#testimonials" className="nav-link">Testimonials</a>
            <div className="nav-divider"></div>
            <Link to="/login" className="nav-link">Log In</Link>
            <button onClick={handleGetStarted} className="btn btn-primary btn-sm glow-effect">
              Start Free Trial
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-background-glow"></div>
        <div className="hero-grid-lines"></div>
        <div className="hero-container">
          <div className="hero-content reveal fade-up">
            <div className="hero-badge">
              <span className="badge-dot"></span>
              <span>India 2026 — ULI & DPDP Compliant</span>
            </div>
            <h1 className="hero-title">
              SME Lending Intelligence <br />
              <span className="gradient-text-primary">At The Speed of AI.</span>
            </h1>
            <p className="hero-description">
              Connect to GST, ITR, bank statements & Aadhaar via <strong>ULI</strong>. Get <strong>consistency scores</strong>, risk flags, and NBFC-ready due diligence reports — with full <strong>DPDP</strong> consent logging and data localisation.
            </p>
            <div className="hero-cta-group">
              <button onClick={handleGetStarted} className="btn btn-primary btn-lg">
                Start Loan Analysis
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </button>
              <Link to="/pricing" className="btn btn-secondary btn-lg">
                View INR Pricing
              </Link>
            </div>
            <div className="hero-trust">
              <p>Trusted by NBFCs and microfinance institutions</p>
              <div className="trust-logos">
                {['GST–ITR Consistency', 'DPDP Audit Trail', 'Indic Language OCR', '90-Day Auto-Delete'].map((logo, i) => (
                  <span key={i} className="trust-logo">{logo}</span>
                ))}
              </div>
            </div>
          </div>

          <div className="hero-visual reveal zoom-in delay-200">
            <div className="visual-glass-container">
              <div className="app-mockup">
                <div className="mockup-header">
                  <div className="traffic-lights">
                    <div className="light red"></div>
                    <div className="light yellow"></div>
                    <div className="light green"></div>
                  </div>
                  <div className="mockup-address">aegis.ai/loan-applications/uli-consent</div>
                </div>
                <div className="mockup-body">
                  <div className="mockup-sidebar">
                    <div className="sidebar-item active"></div>
                    <div className="sidebar-item"></div>
                    <div className="sidebar-item"></div>
                  </div>
                  <div className="mockup-main">
                    <div className="doc-page">
                      <div className="doc-line w-80"></div>
                      <div className="doc-line w-60"></div>
                      <div className="doc-line w-90"></div>
                      <div className="doc-highlight danger">
                        <div className="highlight-tag">Indemnity Risk</div>
                      </div>
                      <div className="doc-line w-70"></div>
                      <div className="doc-line w-80"></div>
                    </div>
                    <div className="ai-popover">
                      <div className="ai-avatar">🤖</div>
                      <div className="ai-message">
                        <strong>Revenue Mismatch Flag</strong>
                        <p>GST taxable value 40% higher than ITR gross receipts. Review for credit committee.</p>
                        <div className="ai-actions">
                          <button className="btn-xs primary">Due Diligence Report</button>
                          <button className="btn-xs secondary">View Consent Log</button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="stats-section section-padding">
        <div className="section-container">
          <div className="stats-grid reveal fade-up">
            <div className="stat-card">
              <div className="stat-icon">📄</div>
              <div className="stat-number" data-target="100">0</div>
              <div className="stat-label">ULI API Calls / Min</div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">✓</div>
              <div className="stat-number" data-target="95">0</div>
              <div className="stat-label">% GST–ITR Match Accuracy</div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">🔒</div>
              <div className="stat-number" data-target="90">0</div>
              <div className="stat-label">Day DPDP Retention</div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">🌐</div>
              <div className="stat-number" data-target="22">0</div>
              <div className="stat-label">Indian Languages (Voice)</div>
            </div>
          </div>
        </div>
      </section>

      {/* Image Slider Section */}
      <section id="slider" className="slider-section section-padding dark-section">
        <div className="section-container">
          <div className="section-header reveal fade-up">
            <h2 className="section-title">SME Lending in Action</h2>
            <p className="section-subtitle">ULI integration, consistency checks, and DPDP-compliant workflows</p>
          </div>
          <div className="slider-container reveal zoom-in">
            <div className="slider-wrapper">
              {sliderImages.map((slide, index) => (
                <div
                  key={index}
                  className={`slider-slide ${index === currentSlide ? 'active' : ''}`}
                  style={{ transform: `translateX(${(index - currentSlide) * 100}%)` }}
                >
                  <div className="slide-content">
                    <div className="slide-icon">{slide.image}</div>
                    <h3 className="slide-title">{slide.title}</h3>
                    <p className="slide-description">{slide.description}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="slider-controls">
              <button className="slider-btn prev" onClick={prevSlide}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </button>
              <div className="slider-dots">
                {sliderImages.map((_, index) => (
                  <button
                    key={index}
                    className={`slider-dot ${index === currentSlide ? 'active' : ''}`}
                    onClick={() => setCurrentSlide(index)}
                  />
                ))}
              </div>
              <button className="slider-btn next" onClick={nextSlide}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* End-to-end: Everything we do */}
      <section id="product-end-to-end" className="section-padding end-to-end-section">
        <div className="section-container">
          <div className="section-header reveal fade-up">
            <h2 className="section-title">Everything we do, <span className="text-gradient">end to end</span></h2>
            <p className="section-subtitle">From upload to action—one place for all your document intelligence.</p>
          </div>
          <div className="e2e-flow">
            <div className="e2e-step reveal fade-up">
              <div className="e2e-step-icon">📤</div>
              <h4>Upload & organize</h4>
              <p>Drop documents, auto-categorize by risk, and manage with folders.</p>
            </div>
            <div className="e2e-arrow" aria-hidden>→</div>
            <div className="e2e-step reveal fade-up">
              <div className="e2e-step-icon">⚡</div>
              <h4>What should I do next?</h4>
              <p>Get one clear action, deadline, and who should handle it.</p>
            </div>
            <div className="e2e-arrow" aria-hidden>→</div>
            <div className="e2e-step reveal fade-up">
              <div className="e2e-step-icon">📋</div>
              <h4>Explain, risk & trust</h4>
              <p>Simple or professional explanations, risk clauses, trust & scam scores.</p>
            </div>
            <div className="e2e-arrow" aria-hidden>→</div>
            <div className="e2e-step reveal fade-up">
              <div className="e2e-step-icon">📊</div>
              <h4>Financial & dashboard</h4>
              <p>Financial impact, deadlines, risk trends, and health at a glance.</p>
            </div>
            <div className="e2e-arrow" aria-hidden>→</div>
            <div className="e2e-step reveal fade-up">
              <div className="e2e-step-icon">💬</div>
              <h4>Chat & act</h4>
              <p>Ask anything, get drafts, negotiate, share safe summaries, find experts.</p>
            </div>
          </div>
          <div className="e2e-feature-grid">
            {featuresByCategory.map((cat, ci) => (
              <div key={cat.id} className="e2e-category reveal fade-up" style={{ transitionDelay: `${ci * 0.05}s` }}>
                <h4 className="e2e-category-title">{cat.label}</h4>
                <ul>
                  {cat.features.slice(0, 6).map((f) => (
                    <li key={f.id}>{f.label}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bento Grid Features */}
      <section id="features" className="section-padding bento-section">
        <div className="section-container">
          <div className="section-header reveal fade-up">
            <h2 className="section-title">Everything you need to <span className="text-gradient">ship safer deals.</span></h2>
            <p className="section-subtitle">Aegis replaces your entire manual review process with intelligent automation.</p>
          </div>

          <div className="bento-grid">
            <div className="bento-card span-2 highlight-card reveal fade-up">
              <div className="card-bg-glow"></div>
              <div className="bento-content">
                <div className="bento-icon-wrapper blue">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M2 12h20" /></svg>
                </div>
                <h3>Autonomous Agent Swarms</h3>
                <p>Five specialized AI agents collaborate to handle different aspects of document review simultaneously—privacy, finance, and legal.</p>
              </div>
              <div className="bento-visual swarm-visual">
                <div className="agent-node a1">🔍</div>
                <div className="agent-node a2">⚖️</div>
                <div className="agent-node a3">🛡️</div>
                <div className="connection-lines"></div>
              </div>
            </div>

            <div className="bento-card reveal fade-up delay-100">
              <div className="bento-content">
                <div className="bento-icon-wrapper purple">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
                </div>
                <h3>Risk Heatmaps</h3>
                <p>Instantly visualize liability exposure across your entire contract database.</p>
              </div>
            </div>

            <div className="bento-card reveal fade-up delay-200">
              <div className="bento-content">
                <div className="bento-icon-wrapper green">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
                </div>
                <h3>Auto-Redlining</h3>
                <p>Accept or reject AI-suggested edits that align with your company playbook.</p>
              </div>
            </div>

            <div className="bento-card reveal fade-up delay-100">
              <div className="bento-content">
                <div className="bento-icon-wrapper orange">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                </div>
                <h3>Voice-First Mode</h3>
                <p>Ask questions verbally and get AI-powered explanations in real-time.</p>
              </div>
            </div>

            <div className="bento-card reveal fade-up delay-200">
              <div className="bento-content">
                <div className="bento-icon-wrapper blue">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3v18h18M7 16l4-4 4 4 6-6" /></svg>
                </div>
                <h3>Trust Score</h3>
                <p>Get an overall document trustworthiness score based on multiple factors.</p>
              </div>
            </div>

            <div className="bento-card span-3 horizontal reveal fade-up">
              <div className="bento-row">
                <div className="bento-content">
                  <div className="bento-icon-wrapper orange">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>
                  </div>
                  <h3>Global Jurisdictions</h3>
                  <p>Compliance checks against GDPR, CCPA, and laws in 50+ countries. Never miss a local regulation again.</p>
                </div>
                <div className="bento-visual map-visual">
                  <div className="map-dot d1"></div>
                  <div className="map-dot d2"></div>
                  <div className="map-dot d3"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Use Cases Section */}
      <section className="use-cases-section section-padding">
        <div className="section-container">
          <div className="section-header reveal fade-up">
            <h2 className="section-title">Perfect for Every Team</h2>
            <p className="section-subtitle">See how different teams use Aegis to streamline their workflows</p>
          </div>
          <div className="use-cases-grid reveal fade-up">
            <div className="use-case-card">
              <div className="use-case-icon">⚖️</div>
              <h3>Legal Teams</h3>
              <p>Review contracts 10x faster with AI-powered risk detection and clause analysis.</p>
            </div>
            <div className="use-case-card">
              <div className="use-case-icon">💼</div>
              <h3>Sales Teams</h3>
              <p>Get instant feedback on NDAs and MSAs to close deals faster without legal bottlenecks.</p>
            </div>
            <div className="use-case-card">
              <div className="use-case-icon">🏢</div>
              <h3>Compliance Teams</h3>
              <p>Ensure all documents meet regulatory requirements across multiple jurisdictions.</p>
            </div>
            <div className="use-case-card">
              <div className="use-case-icon">📊</div>
              <h3>Finance Teams</h3>
              <p>Identify financial risks and obligations in contracts before signing.</p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="section-padding">
        <div className="section-container">
          <div className="section-header reveal fade-up">
            <h2 className="section-title">Workflow of the Future</h2>
          </div>
          <div className="steps-container">
            <div className="step-card reveal fade-up">
              <div className="step-number">01</div>
              <h3>Upload</h3>
              <p>Drag and drop your contract. We support PDF, DOCX, and scanned images via OCR.</p>
            </div>
            <div className="step-connector"></div>
            <div className="step-card reveal fade-up delay-100">
              <div className="step-number">02</div>
              <h3>Agent Analysis</h3>
              <p>Our agent swarm dissects the document into clauses, identifying risks and missing terms.</p>
            </div>
            <div className="step-connector"></div>
            <div className="step-card reveal fade-up delay-200">
              <div className="step-number">03</div>
              <h3>Resolve & Sign</h3>
              <p>Use AI to generate counter-proposals or auto-fix issues. Export clean versions instantly.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Comparison Section */}
      <section className="section-padding dark-section">
        <div className="section-container">
          <div className="comparison-table reveal fade-up">
            <div className="comparison-header">
              <div className="col-blank"></div>
              <div className="col-header manual">Old Way</div>
              <div className="col-header aegis">Aegis AI</div>
            </div>
            <div className="comparison-row">
              <div className="row-label">Time per contract</div>
              <div className="row-val">2-4 Hours</div>
              <div className="row-val highlight">5 Minutes</div>
            </div>
            <div className="comparison-row">
              <div className="row-label">Cost per review</div>
              <div className="row-val">$400+</div>
              <div className="row-val highlight">$10</div>
            </div>
            <div className="comparison-row">
              <div className="row-label">Risk detection</div>
              <div className="row-val">Prone to human error</div>
              <div className="row-val highlight">99.9% accuracy</div>
            </div>
            <div className="comparison-row">
              <div className="row-label">Availability</div>
              <div className="row-val">9-5 Business Days</div>
              <div className="row-val highlight">24/7/365</div>
            </div>
          </div>
        </div>
      </section>

      {/* Security Section */}
      <section id="security" className="section-padding">
        <div className="section-container">
          <h2 className="section-title text-center reveal fade-up" style={{ marginBottom: '60px' }}>Bank-Grade Security</h2>
          <div className="security-badges reveal fade-up">
            <div className="security-badge-item">
              <div className="shield-icon">🔒</div>
              <h3>SOC2 Type II</h3>
              <p>Certified compliant</p>
            </div>
            <div className="security-badge-item">
              <div className="shield-icon">🛡️</div>
              <h3>End-to-End Encryption</h3>
              <p>AES-256 Data Transport</p>
            </div>
            <div className="security-badge-item">
              <div className="shield-icon">🏢</div>
              <h3>Enterprise Grade</h3>
              <p>SAML / SSO Ready</p>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Demo Section */}
      <section id="demo" className="section-padding dark-section">
        <div className="section-container">
          <div className="section-header reveal fade-up">
            <h2 className="section-title">See Aegis in action</h2>
          </div>

          <div className="demo-tabs reveal fade-up">
            <button
              className={`demo-tab ${activeTab === 'upload' ? 'active' : ''}`}
              onClick={() => setActiveTab('upload')}
            >
              1. Upload
            </button>
            <button
              className={`demo-tab ${activeTab === 'analysis' ? 'active' : ''}`}
              onClick={() => setActiveTab('analysis')}
            >
              2. Analysis
            </button>
            <button
              className={`demo-tab ${activeTab === 'chat' ? 'active' : ''}`}
              onClick={() => setActiveTab('chat')}
            >
              3. Chat & Fix
            </button>
          </div>

          <div className="demo-window reveal zoom-in">
            <div className="window-bar">
              <span className="dot red"></span>
              <span className="dot yellow"></span>
              <span className="dot green"></span>
            </div>
            <div className="window-content">
              {activeTab === 'upload' && (
                <div className="demo-view upload-view">
                  <div className="upload-zone">
                    <div className="upload-icon">📄</div>
                    <h3>Drop your contract here</h3>
                    <p>PDF, DOCX, or TXT</p>
                  </div>
                </div>
              )}
              {activeTab === 'analysis' && (
                <div className="demo-view analysis-view">
                  <div className="scanning-line"></div>
                  <div className="analysis-item">
                    <span className="check success">✓</span>
                    <span>Parties Identified</span>
                  </div>
                  <div className="analysis-item">
                    <span className="check warning">!</span>
                    <span>Clause Detection (85%)</span>
                  </div>
                  <div className="analysis-item">
                    <span className="check error">✕</span>
                    <span>Unusual Indemnity Found</span>
                  </div>
                </div>
              )}
              {activeTab === 'chat' && (
                <div className="demo-view chat-view">
                  <div className="chat-bubble ai">
                    Is this indemnity clause standard for a SaaS agreement?
                  </div>
                  <div className="chat-bubble user">
                    No, it is highly unusual. Most SaaS agreements cap liability at 12 months fees.
                  </div>
                  <div className="suggestion-pill">Apply Fix</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="section-padding">
        <div className="section-container">
          <h2 className="section-title text-center reveal fade-up">Frequently Asked Questions</h2>
          <div className="faq-grid reveal fade-up">
            {[
              { q: "Is my data secure?", a: "Yes. We use AES-256 for all data at rest and TLS 1.3 for data in transit. We are SOC2 Type II certified." },
              { q: "Can I use custom playbooks?", a: "Absolutely. You can upload your own company playbook and Aegis will redline documents to match your specific standards." },
              { q: "What file types are supported?", a: "We support PDF, DOCX, TXT, and scanned images (PNG/JPG) via our integrated OCR engine." },
              { q: "Do you offer an API?", a: "Yes, our API allows you to integrate Aegis directly into your CLM or workflows. Contact sales for access." }
            ].map((item, index) => (
              <div key={index} className="faq-item" onClick={() => toggleFaq(index)}>
                <div className="faq-question">
                  <span>{item.q}</span>
                  <span className={`faq-toggle ${activeFaq === index ? 'open' : ''}`}>+</span>
                </div>
                {activeFaq === index && <div className="faq-answer">{item.a}</div>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="section-padding">
        <div className="section-container">
          <h2 className="section-title text-center reveal fade-up">Loved by modern teams</h2>
          <div className="testimonials-grid">
            <div className="testimonial-card reveal fade-up delay-100">
              <div className="quote">"Aegis cut our contract review time by 80%. It finds things our junior associates miss."</div>
              <div className="author">
                <div className="avatar">SJ</div>
                <div>
                  <div className="name">Sarah Jenkins</div>
                  <div className="role">General Counsel, TechFlow</div>
                </div>
              </div>
            </div>
            <div className="testimonial-card reveal fade-up delay-200">
              <div className="quote">"The agent swarm concept is real. It feels like having 5 extra lawyers in the room."</div>
              <div className="author">
                <div className="avatar">MR</div>
                <div>
                  <div className="name">Mike Ross</div>
                  <div className="role">Partner, Pearson Specter</div>
                </div>
              </div>
            </div>
            <div className="testimonial-card reveal fade-up delay-300">
              <div className="quote">"Finally, legal tech that actually looks good and works fast. The UI is incredible."</div>
              <div className="author">
                <div className="avatar">AL</div>
                <div>
                  <div className="name">Ada Lovelace</div>
                  <div className="role">CTO, Babbage Inc</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Box */}
      <section className="section-padding">
        <div className="section-container reveal zoom-in">
          <div className="cta-box">
            <div className="cta-content">
              <h2>Ready to modernize your legal stack?</h2>
              <p>Join 500+ companies using Aegis AI today.</p>
              <div className="cta-buttons">
                <button onClick={handleGetStarted} className="btn btn-primary btn-lg">Get Started Now</button>
                <Link to="/contact" className="btn btn-outline btn-lg">Contact Sales</Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="site-footer">
        <div className="footer-container">
          <div className="footer-brand">
            <div className="landing-logo">
              <svg className="logo-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" strokeWidth="2" />
              </svg>
              <span>Aegis AI</span>
            </div>
            <p>Designed for the future of work.</p>
          </div>
          <div className="footer-links">
            <div className="link-col">
              <h4>Product</h4>
              <a href="#">Features</a>
              <a href="#">Pricing</a>
              <a href="#">Changelog</a>
            </div>
            <div className="link-col">
              <h4>Company</h4>
              <a href="#">About</a>
              <a href="#">Careers</a>
              <a href="#">Blog</a>
            </div>
            <div className="link-col">
              <h4>Legal</h4>
              <Link to="/privacy">Privacy</Link>
              <Link to="/terms">Terms</Link>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          &copy; {new Date().getFullYear()} Aegis AI Inc. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
