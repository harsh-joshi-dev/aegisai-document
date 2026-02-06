import { Link } from 'react-router-dom';
import '../index.css';

export default function PricingPage() {
    return (
        <div className="min-h-screen bg-main pt-24 pb-12 px-6">
            <div className="max-w-7xl mx-auto">
                <div className="text-center mb-16">
                    <h1 className="text-4xl md:text-6xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400 mb-6">
                        Simple, Transparent Pricing
                    </h1>
                    <p className="text-xl text-muted max-w-2xl mx-auto">
                        Choose the plan that fits your document analysis needs. No hidden fees.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {/* Starter Plan */}
                    <div className="glass-panel p-8 relative overflow-hidden group hover:bg-card-hover transition-all duration-300">
                        <h3 className="text-2xl font-bold mb-2">Starter</h3>
                        <div className="text-4xl font-bold mb-6">$0<span className="text-lg text-muted font-normal">/mo</span></div>
                        <p className="text-muted mb-8 h-12">Perfect for individuals trying out Aegis AI.</p>

                        <ul className="mb-8 space-y-4">
                            <li className="flex items-center gap-3 text-sm">
                                <span className="text-success">✓</span> 10 Documents / month
                            </li>
                            <li className="flex items-center gap-3 text-sm">
                                <span className="text-success">✓</span> Basic Risk Analysis
                            </li>
                            <li className="flex items-center gap-3 text-sm">
                                <span className="text-success">✓</span> Standard Support
                            </li>
                        </ul>

                        <Link to="/login" className="w-full btn btn-ghost border border-light hover:border-primary block text-center">
                            Get Started
                        </Link>
                    </div>

                    {/* Pro Plan */}
                    <div className="glass-panel p-8 relative overflow-hidden group border-primary/50 shadow-glow transform md:-translate-y-4">
                        <div className="absolute top-0 right-0 bg-primary text-white text-xs font-bold px-3 py-1 rounded-bl-lg">POPULAR</div>
                        <h3 className="text-2xl font-bold mb-2 text-primary">Pro</h3>
                        <div className="text-4xl font-bold mb-6">$49<span className="text-lg text-muted font-normal">/mo</span></div>
                        <p className="text-muted mb-8 h-12">For professionals requiring detailed analysis.</p>

                        <ul className="mb-8 space-y-4">
                            <li className="flex items-center gap-3 text-sm">
                                <span className="text-success">✓</span> Unlimited Documents
                            </li>
                            <li className="flex items-center gap-3 text-sm">
                                <span className="text-success">✓</span> Advanced Risk & Compliance
                            </li>
                            <li className="flex items-center gap-3 text-sm">
                                <span className="text-success">✓</span> Priority Support
                            </li>
                            <li className="flex items-center gap-3 text-sm">
                                <span className="text-success">✓</span> Agent Swarm Access
                            </li>
                        </ul>

                        <Link to="/login" className="w-full btn btn-primary block text-center shadow-lg">
                            Start Pro Trial
                        </Link>
                    </div>

                    {/* Enterprise Plan */}
                    <div className="glass-panel p-8 relative overflow-hidden group hover:bg-card-hover transition-all duration-300">
                        <h3 className="text-2xl font-bold mb-2">Enterprise</h3>
                        <div className="text-4xl font-bold mb-6">Custom</div>
                        <p className="text-muted mb-8 h-12">For large teams and organizations.</p>

                        <ul className="mb-8 space-y-4">
                            <li className="flex items-center gap-3 text-sm">
                                <span className="text-success">✓</span> Custom Agent Workflows
                            </li>
                            <li className="flex items-center gap-3 text-sm">
                                <span className="text-success">✓</span> API Access
                            </li>
                            <li className="flex items-center gap-3 text-sm">
                                <span className="text-success">✓</span> Dedicated Account Manager
                            </li>
                            <li className="flex items-center gap-3 text-sm">
                                <span className="text-success">✓</span> SSO & Audit Logs
                            </li>
                        </ul>

                        <Link to="/contact" className="w-full btn btn-ghost border border-light hover:border-primary block text-center">
                            Contact Sales
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
