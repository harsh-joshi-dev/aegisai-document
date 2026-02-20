import { motion, AnimatePresence } from 'framer-motion';
import { X, Mail, Phone, MapPin, Send, MessageSquare, Shield } from 'lucide-react';
import { useState } from 'react';

interface ContactModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const ContactModal = ({ isOpen, onClose }: ContactModalProps) => {
    const [submitted, setSubmitted] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitted(true);
        setTimeout(() => {
            setSubmitted(false);
            onClose();
        }, 3000);
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        style={{
                            position: 'fixed',
                            inset: 0,
                            background: 'rgba(3,3,4,0.85)',
                            backdropFilter: 'blur(12px)',
                            zIndex: 1000,
                        }}
                    />
                    <div style={{
                        position: 'fixed',
                        inset: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1001,
                        padding: 20,
                        pointerEvents: 'none'
                    }}>
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                            style={{
                                width: '100%',
                                maxWidth: 900,
                                background: 'rgba(15,15,20,0.95)',
                                border: '1px solid rgba(255,255,255,0.08)',
                                borderRadius: 40,
                                overflow: 'hidden',
                                boxShadow: '0 40px 120px rgba(0,0,0,0.8)',
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
                                pointerEvents: 'auto',
                                position: 'relative'
                            }}
                        >
                            <button
                                onClick={onClose}
                                style={{
                                    position: 'absolute', top: 24, right: 24,
                                    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                                    borderRadius: 12, width: 40, height: 40, display: 'flex',
                                    alignItems: 'center', justifyContent: 'center', color: '#fff',
                                    cursor: 'pointer', zIndex: 10
                                }}
                            >
                                <X size={20} />
                            </button>

                            {/* Left Side: Info */}
                            <div style={{ padding: 60, background: 'linear-gradient(135deg, rgba(79,70,229,0.05), transparent)' }}>
                                <div style={{ fontSize: 10, color: '#818cf8', fontWeight: 800, letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: 20 }}>Intelligence Desk</div>
                                <h2 style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 900, fontSize: 42, color: '#fff', lineHeight: 1.1, marginBottom: 24 }}>Transmit your <br /><span style={{ background: 'linear-gradient(135deg, #818cf8, #c084fc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Briefing.</span></h2>
                                <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.4)', lineHeight: 1.6, marginBottom: 48 }}>Schedule a strategic assessment with our intelligence officers and discover the future of cognitive accounting.</p>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
                                    {[
                                        { icon: Mail, label: 'Transmission', value: 'hello@cadynamix.ai' },
                                        { icon: Phone, label: 'Direct Line', value: '+91 (0) 800-AUDIT-AI' },
                                        { icon: MapPin, label: 'Headquarters', value: 'Intelligence District, Bangalore' }
                                    ].map(item => (
                                        <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                                            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#818cf8' }}>
                                                <item.icon size={18} />
                                            </div>
                                            <div>
                                                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 2 }}>{item.label}</div>
                                                <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{item.value}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Right Side: Form */}
                            <div style={{ padding: 60, background: 'rgba(255,255,255,0.01)', borderLeft: '1px solid rgba(255,255,255,0.04)', display: 'flex', flexDirection: 'column' }}>
                                <AnimatePresence mode="wait">
                                    {submitted ? (
                                        <motion.div
                                            initial={{ opacity: 0, scale: 0.9 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            exit={{ opacity: 0, scale: 0.9 }}
                                            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}
                                        >
                                            <div style={{ width: 80, height: 80, borderRadius: 24, background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#34d399', marginBottom: 32 }}>
                                                <Shield size={40} />
                                            </div>
                                            <h3 style={{ fontSize: 24, fontWeight: 800, color: '#fff', marginBottom: 12 }}>Transmission Received</h3>
                                            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', lineHeight: 1.6 }}>Your briefing has been encrypted and sent to our team. We will respond within 24 hours.</p>
                                        </motion.div>
                                    ) : (
                                        <motion.form
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            onSubmit={handleSubmit}
                                            style={{ display: 'flex', flexDirection: 'column', gap: 24 }}
                                        >
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                                    <label style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em' }}>Legal Name</label>
                                                    <input required placeholder="John Doe" style={{ height: 48, borderRadius: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', padding: '0 16px', color: '#fff', fontSize: 13, outline: 'none' }} />
                                                </div>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                                    <label style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em' }}>Business Email</label>
                                                    <input required type="email" placeholder="john@firm.com" style={{ height: 48, borderRadius: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', padding: '0 16px', color: '#fff', fontSize: 13, outline: 'none' }} />
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                                <label style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em' }}>Intelligence Needs</label>
                                                <select style={{ height: 48, borderRadius: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', padding: '0 16px', color: '#fff', fontSize: 13, outline: 'none', appearance: 'none', cursor: 'pointer' }}>
                                                    <option>Audit Automation</option>
                                                    <option>GST Reconciliation</option>
                                                    <option>Vendor Risk Management</option>
                                                    <option>Full Practice Digitization</option>
                                                </select>
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                                <label style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em' }}>Briefing Details</label>
                                                <textarea placeholder="How can our AI help your firm?..." style={{ height: 100, borderRadius: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', padding: '16px', color: '#fff', fontSize: 13, outline: 'none', resize: 'none' }} />
                                            </div>
                                            <button type="submit" style={{ height: 52, borderRadius: 16, background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', color: '#fff', fontWeight: 900, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.15em', cursor: 'pointer', border: 'none', marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                                                Send Briefing <Send size={14} />
                                            </button>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 12 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: 'rgba(255,255,255,0.3)', fontWeight: 700 }}>
                                                    <Shield size={12} className="text-emerald-500" /> SOC2 Compliant
                                                </div>
                                                <div style={{ width: 4, height: 4, borderRadius: '50%', background: 'rgba(255,255,255,0.1)' }} />
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: 'rgba(255,255,255,0.3)', fontWeight: 700 }}>
                                                    <MessageSquare size={12} className="text-indigo-500" /> Human Support
                                                </div>
                                            </div>
                                        </motion.form>
                                    )}
                                </AnimatePresence>
                            </div>
                        </motion.div>
                    </div>
                </>
            )}
        </AnimatePresence>
    );
};
