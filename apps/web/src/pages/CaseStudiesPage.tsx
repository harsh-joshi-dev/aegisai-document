import { ArrowLeft, ArrowUpRight, TrendingUp, Zap, Shield } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

const caseStudies = [
    {
        id: 'petrochem',
        title: '₹4.2Cr Recovery for Petrochem Giant',
        category: 'GSTR-2B MATCHING',
        desc: 'Identified chronic GST ITC leakages and unclaimed credits spanning 24 months of historical filings.',
        image: 'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?auto=format&fit=crop&q=80&w=800',
        tags: ['Automated Audit', 'ITC Recovery'],
        metric: '₹4.2 Cr Recovered',
        color: '#6366f1',
        icon: TrendingUp,
        longDesc: 'A major petrochemical refinery with over 50,000 monthly invoices faced massive ITC leakage due to vendor non-compliance. CA.Dynamix implemented an automated GSTR-2B reconciliation engine that identified ₹4.2Cr in mismatched credits within the first 30 days of deployment.'
    },
    {
        id: 'sme-audit',
        title: '120hrs/mo Saved for SME Audit Firm',
        category: 'DOCUMENT AUTOMATION',
        desc: 'Automated invoice extraction and P&L validation for over 200 concurrent clients.',
        image: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&q=80&w=800',
        tags: ['Efficiency', 'Scalability'],
        metric: '120hrs saved/mo',
        color: '#a855f7',
        icon: Zap,
        longDesc: 'An SME audit firm struggling with manual data entry for hundreds of small business clients transitioned to CA.Dynamix. The platform now handles 95% of data extraction and initial validation, allowing their senior partners to focus on high-value advisory work.'
    },
    {
        id: 'vendor-compliance',
        title: 'Real-time Vendor Compliance',
        category: 'RISK INTELLIGENCE',
        desc: 'Eliminated manual vendor follow-ups through automated document collection and instant validation.',
        image: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&q=80&w=800',
        tags: ['Monitoring', 'Compliance'],
        metric: '100% On-time Filing',
        color: '#10b981',
        icon: Shield,
        longDesc: 'A large manufacturing conglomerate achieved 100% vendor compliance by deploying our Risk Intelligence Engine. The system automatically triggers follow-ups for expired documents and validates new submissions against government databases in real-time.'
    }
];

export default function CaseStudiesPage() {
    return (
        <div className="min-h-screen bg-[#030304] text-white font-sans selection:bg-indigo-500/30">
            {/* Hero Section */}
            <section className="relative pt-32 pb-20 px-6 border-b border-white/5 overflow-hidden">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none" />
                <div className="max-w-7xl mx-auto relative z-10">
                    <Link to="/" className="inline-flex items-center gap-2 text-zinc-400 hover:text-white transition-colors text-sm font-medium mb-12 bg-white/5 px-4 py-2 rounded-full border border-white/5">
                        <ArrowLeft size={16} /> Back to Intelligence
                    </Link>
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
                        <h1 className="text-6xl md:text-8xl font-black tracking-tighter mb-8 leading-[0.9]">
                            EVIDENCE OF<br /><span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400">EXCELLENCE.</span>
                        </h1>
                        <p className="text-xl text-zinc-400 max-w-2xl leading-relaxed">
                            Discover how leading firms and enterprises are deploying CA.Dynamix to redefine financial audit standards and operational efficiency.
                        </p>
                    </motion.div>
                </div>
            </section>

            {/* Case Studies Grid */}
            <section className="py-24 px-6">
                <div className="max-w-7xl mx-auto">
                    <div className="grid grid-cols-1 gap-32">
                        {caseStudies.map((study, idx) => (
                            <motion.div
                                key={study.id}
                                initial={{ opacity: 0, y: 40 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.8, delay: idx * 0.1 }}
                                className={`flex flex-col ${idx % 2 === 0 ? 'lg:flex-row' : 'lg:flex-row-reverse'} gap-16 items-center`}
                            >
                                <div className="w-full lg:w-1/2">
                                    <div className="relative group rounded-[40px] overflow-hidden border border-white/10 aspect-video">
                                        <img src={study.image} alt={study.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                                        <div className="absolute bottom-8 left-8 flex gap-3">
                                            {study.tags.map(tag => (
                                                <span key={tag} className="px-5 py-2 rounded-full bg-white/10 backdrop-blur-xl border border-white/10 text-xs font-bold uppercase tracking-wider">{tag}</span>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className="w-full lg:w-1/2">
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
                                            <study.icon size={24} style={{ color: study.color }} />
                                        </div>
                                        <span className="text-xs font-black tracking-widest text-zinc-500 uppercase">{study.category}</span>
                                    </div>
                                    <h2 className="text-4xl md:text-5xl font-bold mb-6 tracking-tight leading-tight">{study.title}</h2>
                                    <p className="text-lg text-zinc-400 mb-8 leading-relaxed italic border-l-2 border-indigo-500/50 pl-6">
                                        {study.desc}
                                    </p>
                                    <p className="text-zinc-500 mb-10 text-base leading-relaxed">
                                        {study.longDesc}
                                    </p>

                                    <div className="flex flex-col sm:flex-row gap-8 items-start sm:items-center">
                                        <div className="bg-white/5 border border-white/10 rounded-2xl px-8 py-6">
                                            <div className="text-xs font-black text-indigo-400 uppercase tracking-widest mb-1">Impact Metric</div>
                                            <div className="text-3xl font-black text-white">{study.metric}</div>
                                        </div>
                                        <Link to="/auth" className="inline-flex items-center gap-2 text-white font-bold group">
                                            Explore this Intelligence <ArrowUpRight size={20} className="transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" />
                                        </Link>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Footer CTA */}
            <section className="py-32 px-6 border-t border-white/5">
                <div className="max-w-4xl mx-auto text-center">
                    <h2 className="text-4xl md:text-6xl font-black mb-8">Ready to be our next<br /><span className="text-indigo-500">Success Story?</span></h2>
                    <div className="flex flex-col sm:flex-row gap-6 justify-center">
                        <Link
                            to="/auth"
                            className="px-10 py-5 bg-white font-bold uppercase tracking-widest rounded-2xl hover:bg-zinc-200 transition-all flex items-center justify-center"
                            style={{ color: '#0f172a' }}
                        >
                            Get Started
                        </Link>
                        <Link
                            to="/contact"
                            className="px-10 py-5 bg-white/5 text-white border border-white/10 font-bold uppercase tracking-widest rounded-2xl hover:bg-white/10 transition-all flex items-center justify-center"
                        >
                            Talk to Partners
                        </Link>
                    </div>
                </div>
            </section>
        </div>
    );
}
