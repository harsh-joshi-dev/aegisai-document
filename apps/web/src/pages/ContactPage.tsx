import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Send, Mail, MessageSquare, ArrowLeft, CheckCircle, Shield } from 'lucide-react';

export default function ContactPage() {
    const [submitted, setSubmitted] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitted(true);
    };

    return (
        <div className="min-h-screen bg-[#030304] text-white font-sans relative overflow-hidden selection:bg-indigo-500/30">
            {/* Background */}
            <div className="absolute top-0 left-1/3 w-[600px] h-[600px] bg-indigo-500/5 rounded-full blur-[150px] pointer-events-none" />
            <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-violet-500/5 rounded-full blur-[120px] pointer-events-none" />

            {/* Nav */}
            <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-[#030304]/80 backdrop-blur-md">
                <div className="max-w-7xl mx-auto px-6 h-16 flex items-center">
                    <Link to="/" className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors text-sm font-medium">
                        <ArrowLeft size={16} /> Back to Home
                    </Link>
                </div>
            </header>

            <main className="relative z-10 max-w-2xl mx-auto pt-32 pb-20 px-6">
                <div className="text-center mb-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/5 bg-white/[0.02] text-xs font-medium text-zinc-400 mb-6">
                        <Mail size={14} className="text-indigo-400" />
                        We typically respond within 24 hours
                    </div>
                    <h1 className="font-display text-4xl font-bold text-white tracking-tight">Contact Support</h1>
                    <p className="mt-3 text-zinc-400 max-w-md mx-auto">
                        Have a question or need help? We're here for you.
                    </p>
                </div>

                {submitted ? (
                    <div className="card-premium p-10 text-center animate-in fade-in zoom-in-95 duration-500">
                        <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-5 ring-1 ring-emerald-500/20">
                            <CheckCircle size={32} className="text-emerald-400" />
                        </div>
                        <h3 className="font-display text-xl font-bold text-white mb-2">Message Sent!</h3>
                        <p className="text-zinc-400 text-sm max-w-sm mx-auto">
                            Thank you for reaching out. Our team will review your message and respond within 24 hours.
                        </p>
                        <Link to="/" className="btn-primary mt-8 inline-flex shadow-lg shadow-indigo-500/20">
                            Return Home
                        </Link>
                    </div>
                ) : (
                    <div className="card-premium overflow-hidden animate-in fade-in slide-in-from-bottom-6 duration-700">
                        <div className="p-8">
                            <form onSubmit={handleSubmit} className="space-y-6">
                                <div>
                                    <label htmlFor="contact-name" className="mb-2 block text-xs font-medium text-zinc-500 uppercase tracking-wide">
                                        Full Name
                                    </label>
                                    <input
                                        type="text"
                                        id="contact-name"
                                        required
                                        className="input-field"
                                        placeholder="John Doe"
                                    />
                                </div>

                                <div>
                                    <label htmlFor="contact-email" className="mb-2 block text-xs font-medium text-zinc-500 uppercase tracking-wide">
                                        Email Address
                                    </label>
                                    <input
                                        type="email"
                                        id="contact-email"
                                        required
                                        className="input-field"
                                        placeholder="john@company.com"
                                    />
                                </div>

                                <div>
                                    <label htmlFor="contact-message" className="mb-2 block text-xs font-medium text-zinc-500 uppercase tracking-wide">
                                        Message
                                    </label>
                                    <textarea
                                        id="contact-message"
                                        required
                                        rows={5}
                                        className="input-field resize-none"
                                        placeholder="How can we help you?"
                                    />
                                </div>

                                <button type="submit" className="btn-primary w-full h-12 text-base shadow-lg shadow-indigo-500/20">
                                    <Send size={18} className="mr-2" />
                                    Send Message
                                </button>
                            </form>
                        </div>

                        {/* Footer */}
                        <div className="border-t border-white/5 bg-white/[0.01] px-8 py-4 flex items-center justify-center gap-6">
                            <div className="flex items-center gap-2 text-xs text-zinc-500">
                                <Shield size={14} className="text-emerald-400" />
                                Your data is encrypted and secure
                            </div>
                            <div className="flex items-center gap-2 text-xs text-zinc-500">
                                <MessageSquare size={14} className="text-indigo-400" />
                                24h response time
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
