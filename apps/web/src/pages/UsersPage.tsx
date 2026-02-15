import { FormEvent, useState } from 'react';
import { UserRecord } from '../mock/types';
import { useMockStore } from '../state/mockStore';
import { useToast } from '../state/toast';
import { UserPlus, Shield, Eye, Crown, Users } from 'lucide-react';

const roleConfig: Record<string, { icon: typeof Shield; color: string; bg: string; border: string }> = {
  Owner: { icon: Crown, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
  Admin: { icon: Shield, color: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/20' },
  Reviewer: { icon: Eye, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  Viewer: { icon: Users, color: 'text-zinc-400', bg: 'bg-zinc-500/10', border: 'border-zinc-500/20' },
};

export default function UsersPage() {
  const { users, addUser } = useMockStore();
  const { push } = useToast();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRecord['role']>('Reviewer');

  const invite = (e: FormEvent) => {
    e.preventDefault();
    const user: UserRecord = { id: `u-${Date.now()}`, name, email, role };
    addUser(user);
    push({ kind: 'success', title: 'Invite sent', message: `${user.name} (${user.role})` });
    setName('');
    setEmail('');
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-white/5 pb-6">
        <div>
          <h1 className="font-display text-3xl font-bold text-white tracking-tight">Team</h1>
          <p className="mt-2 text-sm text-zinc-400 max-w-xl">Manage workspace members, roles, and access permissions.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0e0e11] border border-white/5 text-sm text-zinc-300">
            <Users size={16} className="text-zinc-500" />
            <span className="font-medium">{users.length}</span>
            <span className="text-zinc-500">members</span>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        {/* Members List */}
        <section className="card-premium overflow-hidden">
          <div className="p-6 border-b border-white/5">
            <h2 className="font-display text-lg font-bold text-white">Workspace Members</h2>
            <p className="text-xs text-zinc-500 mt-1">People with access to this workspace</p>
          </div>
          <div className="divide-y divide-white/5">
            {users.map((u) => {
              const rc = roleConfig[u.role] || roleConfig.Viewer;
              const RoleIcon = rc.icon;
              return (
                <div key={u.id} className="group flex items-center gap-4 px-6 py-4 hover:bg-white/[0.02] transition-colors">
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-white/10 flex items-center justify-center text-sm font-bold text-indigo-300 shrink-0">
                    {u.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate group-hover:text-indigo-300 transition-colors">{u.name}</p>
                    <p className="text-xs text-zinc-500 truncate">{u.email}</p>
                  </div>
                  {/* Role Badge */}
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${rc.color} ${rc.bg} ${rc.border}`}>
                    <RoleIcon size={12} />
                    {u.role}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        {/* Invite Form */}
        <section className="card-premium h-fit sticky top-24">
          <div className="p-6 border-b border-white/5 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400">
              <UserPlus size={20} />
            </div>
            <div>
              <h3 className="font-display text-lg font-bold text-white">Invite Member</h3>
              <p className="text-xs text-zinc-500">Send an invitation to join this workspace</p>
            </div>
          </div>
          <div className="p-6">
            <form className="space-y-5" onSubmit={invite}>
              <div>
                <label className="mb-2 block text-xs font-medium text-zinc-500 uppercase tracking-wide">Full Name</label>
                <input
                  className="input-field"
                  placeholder="e.g. Jane Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="mb-2 block text-xs font-medium text-zinc-500 uppercase tracking-wide">Email Address</label>
                <input
                  className="input-field"
                  type="email"
                  placeholder="jane@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="mb-2 block text-xs font-medium text-zinc-500 uppercase tracking-wide">Role</label>
                <div className="relative">
                  <select
                    className="input-field appearance-none cursor-pointer"
                    value={role}
                    onChange={(e) => setRole(e.target.value as UserRecord['role'])}
                  >
                    <option value="Owner">Owner — Full access</option>
                    <option value="Admin">Admin — Manage settings & users</option>
                    <option value="Reviewer">Reviewer — Review & approve docs</option>
                    <option value="Viewer">Viewer — Read-only access</option>
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500">
                    <svg width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 1L5 5L9 1" /></svg>
                  </div>
                </div>
              </div>
              <button type="submit" className="btn-primary w-full h-11 text-sm shadow-lg shadow-indigo-500/20">
                <UserPlus size={16} className="mr-2" />
                Send Invitation
              </button>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}
