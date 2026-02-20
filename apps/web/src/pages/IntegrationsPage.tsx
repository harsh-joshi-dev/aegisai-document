import { useState } from 'react';
import { Puzzle, Plus, ExternalLink, Zap, Database, MessageSquare } from 'lucide-react';

interface Integration {
    id: string;
    name: string;
    description: string;
    category: 'ERP' | 'Communication' | 'Cloud Storage' | 'Compliance';
    status: 'connected' | 'disconnected' | 'coming_soon';
    icon: any;
}

const integrations: Integration[] = [
    { id: '1', name: 'SAP S/4HANA', description: 'Enterprise resource planning and finance data sync.', category: 'ERP', status: 'connected', icon: Database },
    { id: '2', name: 'Slack', description: 'Receive real-time anomaly alerts in dedicated channels.', category: 'Communication', status: 'connected', icon: MessageSquare },
    { id: '3', name: 'Oracle Cloud', description: 'Automated data extraction from Oracle cloud environments.', category: 'ERP', status: 'disconnected', icon: CloudDownload },
    { id: '4', name: 'Microsoft Teams', description: 'Collaborative workflow approvals within Teams.', category: 'Communication', status: 'coming_soon', icon: MessageSquare },
    { id: '5', name: 'Amazon S3', description: 'Secure document storage and ingestion pipeline.', category: 'Cloud Storage', status: 'connected', icon: Zap },
    { id: '6', name: 'QuickBooks', description: 'Small business accounting and ledger automation.', category: 'ERP', status: 'disconnected', icon: Database },
];

import { CloudDownload } from 'lucide-react';

export default function IntegrationsPage() {
    const [activeTab, setActiveTab] = useState<'all' | 'connected'>('all');

    const filtered = integrations.filter(i => activeTab === 'all' || i.status === 'connected');

    return (
        <div className="w-full space-y-10 animate-fade-in">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 border-b border-subtle pb-8">
                <div>
                    <h1 className="text-4xl font-bold text-main tracking-tight">
                        System <span className="text-gradient">Integrations</span>
                    </h1>
                    <p className="mt-3 text-base text-muted max-w-2xl leading-relaxed">
                        Connect Aegis AI with your existing enterprise stack. Automate data flow,
                        synchronize metadata, and unify your operational intelligence.
                    </p>
                </div>
                <button className="btn-primary">
                    <Plus size={20} />
                    Request Integration
                </button>
            </div>

            <div className="flex gap-4 p-1.5 rounded-2xl bg-subtle w-fit border border-subtle">
                <button
                    onClick={() => setActiveTab('all')}
                    className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'all' ? 'bg-card text-primary shadow-sm' : 'text-dim hover:text-muted'}`}
                >
                    All Marketplace
                </button>
                <button
                    onClick={() => setActiveTab('connected')}
                    className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'connected' ? 'bg-card text-primary shadow-sm' : 'text-dim hover:text-muted'}`}
                >
                    Connected
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {filtered.map((item) => (
                    <div key={item.id} className="card-premium p-6 flex flex-col group h-full">
                        <div className="flex items-start justify-between mb-6">
                            <div className="w-14 h-14 rounded-2xl bg-subtle border border-subtle flex items-center justify-center group-hover:border-primary/50 group-hover:shadow-glow transition-all duration-300">
                                <item.icon size={28} className="text-muted group-hover:text-primary transition-colors" />
                            </div>
                            <div className="flex flex-col items-end">
                                {item.status === 'connected' && (
                                    <span className="px-2.5 py-1 rounded-full bg-success/10 text-success text-[10px] font-bold uppercase tracking-wider border border-success/20">
                                        Active
                                    </span>
                                )}
                                {item.status === 'disconnected' && (
                                    <span className="px-2.5 py-1 rounded-full bg-subtle text-dim text-[10px] font-bold uppercase tracking-wider border border-subtle">
                                        Inactive
                                    </span>
                                )}
                                {item.status === 'coming_soon' && (
                                    <span className="px-2.5 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider border border-primary/20">
                                        Coming Soon
                                    </span>
                                )}
                            </div>
                        </div>

                        <div className="mb-8 flex-1">
                            <h3 className="text-xl font-bold text-main mb-2 tracking-tight">{item.name}</h3>
                            <p className="text-sm text-dim leading-relaxed">{item.description}</p>
                            <div className="mt-4 flex items-center gap-2">
                                <span className="text-[10px] uppercase font-bold tracking-widest text-muted bg-subtle px-2 py-0.5 rounded border border-subtle">{item.category}</span>
                            </div>
                        </div>

                        <div className="pt-6 border-t border-subtle flex items-center justify-between">
                            {item.status === 'connected' ? (
                                <>
                                    <button className="text-xs font-bold text-danger hover:underline">Disconnect</button>
                                    <button className="flex items-center gap-1.5 text-xs font-bold text-primary group-hover:translate-x-1 transition-transform">
                                        Configure <ExternalLink size={12} />
                                    </button>
                                </>
                            ) : item.status === 'disconnected' ? (
                                <button className="w-full btn-secondary text-xs py-2.5">Connect Now</button>
                            ) : (
                                <button className="w-full btn-secondary text-xs py-2.5 opacity-50 cursor-not-allowed">Enable Waitlist</button>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            <div className="card-premium p-8 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 relative overflow-hidden">
                <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
                    <div>
                        <h2 className="text-2xl font-bold text-main mb-2 tracking-tight">Need a Custom Integration?</h2>
                        <p className="text-muted text-sm max-w-xl">
                            Our SDK allows you to build proprietary connectors for your internal tools.
                            Deploy private integrations that never leave your cloud environment.
                        </p>
                    </div>
                    <button className="btn-primary px-8">
                        Access Developer Portal
                    </button>
                </div>
                <div className="absolute top-0 right-0 p-8 transform translate-x-1/3 -translate-y-1/3 opacity-10">
                    <Puzzle size={200} className="text-primary" />
                </div>
            </div>
        </div>
    );
}
