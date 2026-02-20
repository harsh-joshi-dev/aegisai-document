import { ArrowLeft, MapPin, Briefcase, Zap, Star, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

const openings = [
    {
        title: 'AI Engineering Lead',
        department: 'Engineering',
        location: 'Remote / Bangalore',
        type: 'Full-time'
    },
    {
        title: 'Senior Financial Analyst',
        department: 'AI Training & QA',
        location: 'Remote / Bangalore',
        type: 'Full-time'
    },
    {
        title: 'Enterprise Product Designer',
        department: 'Design',
        location: 'Remote',
        type: 'Full-time'
    },
    {
        title: 'Risk Intelligence Officer',
        department: 'Operations',
        location: 'Bangalore',
        type: 'Full-time'
    }
];

export default function CareersPage() {
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
                            BUILD THE<br /><span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400">NEXT FRONTIER.</span>
                        </h1>
                        <p className="text-xl text-zinc-400 max-w-2xl leading-relaxed">
                            We are building a cognitive financial operating system for the next generation of audit firms. Join us in redefining human-AI collaboration.
                        </p>
                    </motion.div>
                </div>
            </section>

            <section className="py-24 px-6">
                <div className="max-w-7xl mx-auto">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-24">
                        <div className="p-10 bg-white/[0.02] border border-white/5 rounded-[40px] text-center">
                            <div className="w-16 h-16 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl flex items-center justify-center mx-auto mb-8 text-indigo-400">
                                <Zap size={32} />
                            </div>
                            <h3 className="text-2xl font-bold mb-4">Hyper-growth</h3>
                            <p className="text-zinc-500 leading-relaxed">Early-stage equity and high ownership in core infrastructure projects.</p>
                        </div>
                        <div className="p-10 bg-white/[0.02] border border-white/5 rounded-[40px] text-center">
                            <div className="w-16 h-16 bg-purple-500/10 border border-purple-500/20 rounded-2xl flex items-center justify-center mx-auto mb-8 text-purple-400">
                                <Star size={32} />
                            </div>
                            <h3 className="text-2xl font-bold mb-4">Elite Culture</h3>
                            <p className="text-zinc-500 leading-relaxed">Work with senior talent from top global SaaS and AI companies.</p>
                        </div>
                        <div className="p-10 bg-white/[0.02] border border-white/5 rounded-[40px] text-center">
                            <div className="w-16 h-16 bg-pink-500/10 border border-pink-500/20 rounded-2xl flex items-center justify-center mx-auto mb-8 text-pink-400">
                                <Users size={32} />
                            </div>
                            <h3 className="text-2xl font-bold mb-4">Remote First</h3>
                            <p className="text-zinc-500 leading-relaxed">We focus on outcomes, not hours. Work from anywhere in the world.</p>
                        </div>
                    </div>

                    <div className="mb-12">
                        <h2 className="text-3xl font-bold mb-8 flex items-center gap-4">
                            <Briefcase className="text-indigo-500" /> Open Missions
                        </h2>
                        <div className="space-y-4">
                            {openings.map((job, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, x: -20 }}
                                    whileInView={{ opacity: 1, x: 0 }}
                                    viewport={{ once: true }}
                                    transition={{ delay: i * 0.1 }}
                                    className="group p-8 bg-white/[0.02] border border-white/5 rounded-3xl flex flex-col md:flex-row md:items-center justify-between hover:border-white/20 transition-all cursor-pointer"
                                >
                                    <div className="mb-6 md:mb-0">
                                        <h3 className="text-xl font-bold mb-2 group-hover:text-indigo-400 transition-colors">{job.title}</h3>
                                        <div className="flex flex-wrap gap-6 text-xs font-black tracking-widest text-zinc-500 uppercase">
                                            <span className="flex items-center gap-2"><Briefcase size={12} /> {job.department}</span>
                                            <span className="flex items-center gap-2"><MapPin size={12} /> {job.location}</span>
                                            <span className="px-3 py-1 bg-white/5 rounded-full border border-white/5">{job.type}</span>
                                        </div>
                                    </div>
                                    <button className="px-8 py-4 bg-white/5 group-hover:bg-indigo-600 border border-white/10 group-hover:border-indigo-500 text-white font-bold text-xs uppercase tracking-widest rounded-2xl transition-all">
                                        Initiate Application
                                    </button>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            <section className="py-32 px-6 border-t border-white/5 text-center">
                <h2 className="text-5xl font-black mb-8">Role not listed?</h2>
                <p className="text-xl text-zinc-500 mb-12 max-w-2xl mx-auto">If you are an elite individual with a vision for the future of finance, transmit your dossier to our talent acquisition desk.</p>
                <button className="px-12 py-6 bg-white text-[#030304] font-black text-sm uppercase tracking-[0.2em] rounded-2xl hover:bg-zinc-200 transition-all">
                    careers@cadynamix.ai
                </button>
            </section>
        </div>
    );
}
