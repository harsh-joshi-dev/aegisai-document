import { Link } from 'react-router-dom';
import { ArrowLeft, FileText, Scale, UserCheck, Briefcase, Ban } from 'lucide-react';

const sections = [
    {
        icon: Scale,
        title: '1. Acceptance of Terms',
        content: 'By accessing or using Aegis AI, you agree to be bound by these Terms of Service. If you disagree with any part of the terms, you may not access the service.',
    },
    {
        icon: FileText,
        title: '2. Description of Service',
        content: 'Aegis AI provides AI-powered document analysis tools. You understand that the analysis provided is for informational purposes only and does not constitute legal advice.',
    },
    {
        icon: UserCheck,
        title: '3. User Responsibilities',
        content: 'You are responsible for maintaining the confidentiality of your account and password. You agree to accept responsibility for all activities that occur under your account.',
    },
    {
        icon: Briefcase,
        title: '4. Intellectual Property',
        content: 'The service and its original content, features, and functionality are owned by Aegis AI and are protected by international copyright, trademark, patent, trade secret, and other intellectual property or proprietary rights laws.',
    },
    {
        icon: Ban,
        title: '5. Termination',
        content: 'We may terminate or suspend access to our service immediately, without prior notice or liability, for any reason whatsoever, including without limitation if you breach the Terms.',
    },
];

export default function TermsPage() {
    return (
        <div className="min-h-screen bg-[#030304] text-white font-sans relative overflow-hidden selection:bg-indigo-500/30">
            {/* Background */}
            <div className="absolute top-20 left-1/4 w-[500px] h-[500px] bg-violet-500/5 rounded-full blur-[130px] pointer-events-none" />

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
                        <Scale size={14} className="text-indigo-400" />
                        Legal Agreement
                    </div>
                    <h1 className="font-display text-4xl font-bold text-white tracking-tight">Terms of Service</h1>
                    <p className="mt-3 text-sm text-zinc-500">
                        Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
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
