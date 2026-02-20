import { ArrowLeft, Target, Eye, ShieldCheck, Heart } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

export default function AboutPage() {
    return (
        <div className="min-h-screen bg-[#030304] text-white font-sans selection:bg-indigo-500/30">
            <section className="relative pt-32 pb-20 px-6 border-b border-white/5 overflow-hidden">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none" />
                <div className="max-w-7xl mx-auto relative z-10">
                    <Link to="/" className="inline-flex items-center gap-2 text-zinc-400 hover:text-white transition-colors text-sm font-medium mb-12 bg-white/5 px-4 py-2 rounded-full border border-white/5">
                        <ArrowLeft size={16} /> Back to Home
                    </Link>
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
                        <h1 className="text-6xl md:text-8xl font-black tracking-tighter mb-8 leading-[0.9]">
                            DEFINING THE<br /><span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400">NEXT STANDARD.</span>
                        </h1>
                        <p className="text-xl text-zinc-400 max-w-2xl leading-relaxed">
                            CA.Dynamix is an AI-First Decision Intelligence OS designed for the rigorous demands of modern audit practices.
                        </p>
                    </motion.div>
                </div>
            </section>

            <section className="py-24 px-6 border-b border-white/5">
                <div className="max-w-7xl mx-auto">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-24 items-center">
                        <div>
                            <h2 className="text-4xl font-bold mb-8">Our Mission</h2>
                            <p className="text-xl text-zinc-400 leading-relaxed mb-8">
                                The role of the accountant is evolving. As data complexity explodes, human intuition must be augmented by precise, low-latency intelligence.
                            </p>
                            <p className="text-lg text-zinc-500 leading-relaxed mb-8">
                                We are building the tools that allow professionals to spend less time on manual extraction and more time on high-impact strategic advisory. Our intelligence agents are trained on complex tax codes, compliance frameworks, and global accounting standards to provide absolute accuracy.
                            </p>
                            <div className="flex gap-12 pt-8">
                                <div>
                                    <div className="text-4xl font-black text-white mb-2">2023</div>
                                    <div className="text-xs font-black tracking-widest text-zinc-600 uppercase">Founded In</div>
                                </div>
                                <div>
                                    <div className="text-4xl font-black text-white mb-2">50M+</div>
                                    <div className="text-xs font-black tracking-widest text-zinc-600 uppercase">Docs Audited</div>
                                </div>
                                <div>
                                    <div className="text-4xl font-black text-white mb-2">99.9%</div>
                                    <div className="text-xs font-black tracking-widest text-zinc-600 uppercase">Extraction</div>
                                </div>
                            </div>
                        </div>
                        <div className="relative">
                            <div className="absolute inset-0 bg-indigo-500/10 blur-[100px] rounded-full" />
                            <img
                                src="https://images.unsplash.com/photo-1573161158521-8034a83d4153?auto=format&fit=crop&q=80&w=1200"
                                alt="Modern Architecture"
                                className="relative z-10 w-full rounded-[40px] border border-white/10 shadow-2xl"
                            />
                        </div>
                    </div>
                </div>
            </section>

            <section className="py-24 px-6">
                <div className="max-w-7xl mx-auto">
                    <h2 className="text-3xl font-bold mb-16 text-center">Core Principles</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                        <div className="p-8 bg-white/[0.02] border border-white/5 rounded-3xl">
                            <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center mb-6 text-indigo-400">
                                <Target size={24} />
                            </div>
                            <h3 className="text-xl font-bold mb-4">Precision First</h3>
                            <p className="text-zinc-500 text-sm leading-relaxed">Absolute fidelity in data extraction. We don't guess; we verify against multiple source nodes.</p>
                        </div>
                        <div className="p-8 bg-white/[0.02] border border-white/5 rounded-3xl">
                            <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center mb-6 text-purple-400">
                                <ShieldCheck size={24} />
                            </div>
                            <h3 className="text-xl font-bold mb-4">Integrity Always</h3>
                            <p className="text-zinc-500 text-sm leading-relaxed">Built-in governance and military-grade security at every layer of the operating system.</p>
                        </div>
                        <div className="p-8 bg-white/[0.02] border border-white/5 rounded-3xl">
                            <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center mb-6 text-pink-400">
                                <Eye size={24} />
                            </div>
                            <h3 className="text-xl font-bold mb-4">Radical Transparency</h3>
                            <p className="text-zinc-500 text-sm leading-relaxed">Every AI decision is explorable, traceable, and backed by evidence logs.</p>
                        </div>
                        <div className="p-8 bg-white/[0.02] border border-white/5 rounded-3xl">
                            <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center mb-6 text-emerald-400">
                                <Heart size={24} />
                            </div>
                            <h3 className="text-xl font-bold mb-4">Human Centric</h3>
                            <p className="text-zinc-500 text-sm leading-relaxed">Designed to empower human professionals, not replace them. Human-in-the-loop by design.</p>
                        </div>
                    </div>
                </div>
            </section>

            <section className="py-32 px-6 border-t border-white/5 bg-white/[0.01]">
                <div className="max-w-4xl mx-auto text-center">
                    <div className="text-xs font-black tracking-widest text-indigo-500 uppercase mb-8">Executive Board</div>
                    <h2 className="text-5xl font-black mb-16 italic font-serif">"Our vision is to build the world's first truly sentient audit infrastructure."</h2>
                    <div className="flex flex-col items-center">
                        <div className="w-20 h-20 rounded-full bg-zinc-800 mb-6 border border-white/10 overflow-hidden" />
                        <div className="text-xl font-bold">Harsh Joshi</div>
                        <div className="text-xs font-black tracking-widest text-zinc-600 uppercase mt-1">Founder & Intelligence Lead</div>
                    </div>
                </div>
            </section>
        </div>
    );
}
