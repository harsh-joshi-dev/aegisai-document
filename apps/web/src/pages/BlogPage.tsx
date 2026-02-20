import { ArrowLeft, Clock, Calendar, ArrowRight, BookOpen } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

const posts = [
    {
        id: 1,
        title: 'The Future of AI in Chartered Accountancy',
        excerpt: 'How cognitive agents are redefining the role of senior auditors and improving precision in multi-entity filings.',
        date: 'February 18, 2026',
        readTime: '6 min read',
        category: 'Technology',
        image: 'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?auto=format&fit=crop&q=80&w=800'
    },
    {
        id: 2,
        title: 'Navigating GSTR-2B Reconciliation at Scale',
        excerpt: 'Identifying chronic GST ITC leakages and unclaimed credits spanning 24 months of historical filings.',
        date: 'February 12, 2026',
        readTime: '8 min read',
        category: 'Compliance',
        image: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&q=80&w=1200'
    },
    {
        id: 3,
        title: 'Security Best Practices for Financial Documents',
        excerpt: 'Protecting bank-grade sensitive data with zero-knowledge architecture and military-grade encryption.',
        date: 'February 5, 2026',
        readTime: '5 min read',
        category: 'Security',
        image: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&q=80&w=800'
    }
];

export default function BlogPage() {
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
                            THOUGHTS ON<br /><span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400">INTELLIGENCE.</span>
                        </h1>
                        <p className="text-xl text-zinc-400 max-w-2xl leading-relaxed">
                            Insights, updates, and deep dives into the future of financial decision intelligence and automated auditing.
                        </p>
                    </motion.div>
                </div>
            </section>

            <section className="py-24 px-6">
                <div className="max-w-7xl mx-auto">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {posts.map((post, idx) => (
                            <motion.div
                                key={post.id}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.5, delay: idx * 0.1 }}
                                className="group bg-white/[0.02] border border-white/5 rounded-3xl overflow-hidden hover:border-indigo-500/30 transition-all hover:translate-y-[-4px]"
                            >
                                <div className="aspect-video relative overflow-hidden">
                                    <img src={post.image} alt={post.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                                    <div className="absolute top-4 left-4">
                                        <span className="px-3 py-1 rounded-full bg-indigo-500 text-white text-[10px] font-black uppercase tracking-widest">{post.category}</span>
                                    </div>
                                </div>
                                <div className="p-8">
                                    <div className="flex items-center gap-4 text-xs text-zinc-500 mb-4">
                                        <span className="flex items-center gap-1"><Calendar size={12} /> {post.date}</span>
                                        <span className="flex items-center gap-1"><Clock size={12} /> {post.readTime}</span>
                                    </div>
                                    <h3 className="text-xl font-bold mb-4 group-hover:text-indigo-400 transition-colors leading-tight">{post.title}</h3>
                                    <p className="text-zinc-400 text-sm leading-relaxed mb-6">{post.excerpt}</p>
                                    <button className="flex items-center gap-2 text-white font-bold text-xs uppercase tracking-widest group-hover:gap-3 transition-all">
                                        Read Report <ArrowRight size={14} />
                                    </button>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            <section className="py-32 px-6 border-t border-white/5">
                <div className="max-w-4xl mx-auto text-center">
                    <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-8 border border-white/10">
                        <BookOpen size={32} className="text-indigo-400" />
                    </div>
                    <h2 className="text-4xl md:text-5xl font-black mb-8">Subscribe to the Intelligence briefing.</h2>
                    <div className="max-w-md mx-auto relative">
                        <input
                            type="email"
                            placeholder="Enter business email"
                            className="w-full h-16 bg-white/5 border border-white/10 rounded-2xl px-6 focus:outline-none focus:border-indigo-500/50 transition-all text-sm"
                        />
                        <button className="absolute right-2 top-2 bottom-2 bg-indigo-600 hover:bg-indigo-500 text-white px-6 rounded-xl font-bold text-xs uppercase tracking-widest transition-all">
                            Join v4.2
                        </button>
                    </div>
                </div>
            </section>
        </div>
    );
}
