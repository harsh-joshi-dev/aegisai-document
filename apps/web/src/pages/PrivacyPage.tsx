import { Link } from 'react-router-dom';
import { ArrowLeft, Shield, Lock, Eye, Mail } from 'lucide-react';

const sections = [
    {
        icon: Eye,
        title: '1. Information We Collect',
        content: 'We collect information that you provide directly to us when you register for an account, upload documents, or communicate with us.',
        items: [
            'Personal identifiers (name, email address)',
            'Document content uploaded for analysis',
            'Usage data and interaction logs',
        ],
    },
    {
        icon: Shield,
        title: '2. How We Use Your Information',
        content: 'We use the information we collect to:',
        items: [
            'Provide, maintain, and improve our services',
            'Process and analyze your documents using our AI agents',
            'Send you technical notices and support messages',
            'Monitor and analyze trends and usage',
        ],
    },
    {
        icon: Lock,
        title: '3. Data Security',
        content: 'We implement appropriate technical and organizational measures to protect your personal data against unauthorized alteration, disclosure, or destruction. Your documents are encrypted at rest and in transit.',
        items: [],
    },
    {
        icon: Mail,
        title: '4. Contact Us',
        content: 'If you have questions about this Privacy Policy, please contact us at support@aegisai.com.',
        items: [],
    },
];

export default function PrivacyPage() {
    return (
        <div className="min-h-screen bg-[#030304] text-white font-sans relative overflow-hidden selection:bg-indigo-500/30">
            {/* Background */}
            <div className="absolute top-20 right-1/4 w-[500px] h-[500px] bg-indigo-500/5 rounded-full blur-[130px] pointer-events-none" />

            {/* Nav */}
            <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-[#030304]/80 backdrop-blur-md">
                <div className="max-w-7xl mx-auto px-6 h-16 flex items-center">
                    <Link to="/" className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors text-sm font-medium">
                        <ArrowLeft size={16} /> Back to Home
                    </Link>
                </div>
            </header>

            <main className="relative z-10 max-w-3xl mx-auto pt-32 pb-20 px-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {/* Header */}
                <div className="mb-12 text-center">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/5 bg-white/[0.02] text-xs font-medium text-zinc-400 mb-6">
                        <Shield size={14} className="text-emerald-400" />
                        Your privacy is important to us
                    </div>
                    <h1 className="font-display text-4xl font-bold text-white tracking-tight">Privacy Policy</h1>
                    <p className="mt-3 text-sm text-zinc-500">
                        Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                </div>

                {/* Intro */}
                <div className="card-premium p-6 mb-8">
                    <p className="text-sm text-zinc-300 leading-relaxed">
                        At Aegis AI, we take your privacy seriously. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website or use our document analysis services.
                    </p>
                </div>

                {/* Sections */}
                <div className="space-y-6">
                    {sections.map((section, i) => {
                        const Icon = section.icon;
                        return (
                            <div key={i} className="card-premium p-6 group hover:-translate-y-0.5 transition-all duration-200">
                                <div className="flex items-start gap-4">
                                    <div className="p-2.5 rounded-xl bg-white/5 shrink-0 text-zinc-400 group-hover:bg-indigo-500/10 group-hover:text-indigo-400 transition-colors">
                                        <Icon size={20} />
                                    </div>
                                    <div>
                                        <h2 className="font-display text-lg font-bold text-white mb-3">{section.title}</h2>
                                        <p className="text-sm text-zinc-400 leading-relaxed">{section.content}</p>
                                        {section.items.length > 0 && (
                                            <ul className="mt-4 space-y-2">
                                                {section.items.map((item, j) => (
                                                    <li key={j} className="flex items-start gap-2 text-sm text-zinc-300">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-2 shrink-0" />
                                                        {item}
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </main>
        </div>
    );
}
