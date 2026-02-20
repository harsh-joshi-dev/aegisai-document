import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { listWorkspaces, selectWorkspace, type WorkspaceMembership } from '../api/client';
import { useAuth } from './auth';

export type WorkspaceId = string;

export interface Workspace {
  id: WorkspaceId;
  name: string;
}

interface WorkspaceContextValue {
  workspaces: Workspace[];
  activeWorkspace: Workspace;
  setActiveWorkspaceId: (id: WorkspaceId) => void;
  /** Lowercase role from backend membership. */
  role: WorkspaceMembership['role'] | null;
}

const WorkspaceContext = createContext<WorkspaceContextValue | undefined>(undefined);

const ACTIVE_TENANT_KEY = 'aegis_active_tenant_v1';

function readPreferredTenantId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_TENANT_KEY);
  } catch {
    return null;
  }
}

function writePreferredTenantId(id: string) {
  try {
    localStorage.setItem(ACTIVE_TENANT_KEY, id);
  } catch {
    // ignore
  }
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [memberships, setMemberships] = useState<WorkspaceMembership[]>([]);
  const [activeId, setActiveId] = useState<WorkspaceId>(() => readPreferredTenantId() ?? '');
  const [role, setRole] = useState<WorkspaceMembership['role'] | null>(null);
  const [booted, setBooted] = useState(false);

  const workspaces = useMemo<Workspace[]>(
    () => memberships.map((m) => ({ id: m.tenantId, name: m.name })),
    [memberships]
  );

  useEffect(() => {
    if (activeId) writePreferredTenantId(activeId);
  }, [activeId]);

  const activeWorkspace = useMemo(
    () => workspaces.find((w) => w.id === activeId) ?? workspaces[0] ?? { id: '', name: 'Workspace' },
    [activeId, workspaces]
  );

  const setActiveWorkspaceId = useCallback((id: WorkspaceId) => {
    setActiveId(id);
    if (id) writePreferredTenantId(id);
    // Best-effort: update backend workspace context stored in session.
    selectWorkspace(id)
      .then((selected) => setRole((selected.role as any) ?? null))
      .catch(() => setRole(null));
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Avoid spamming 401s when not logged in
        if (!isAuthenticated) {
          if (!cancelled) {
            setMemberships([]);
            setActiveId('');
            setRole(null);
          }
          return;
        }

        const res = await listWorkspaces();
        const ws = res.workspaces || [];
        if (cancelled) return;
        setMemberships(ws);

        const preferred = readPreferredTenantId();
        const initial = (preferred && ws.some((m) => m.tenantId === preferred)) ? preferred : (ws[0]?.tenantId ?? '');
        if (initial) {
          setActiveId(initial);
          try {
            const selected = await selectWorkspace(initial);
            if (!cancelled) setRole((selected.role as any) ?? null);
          } catch {
            // If session can't be set, workspace middleware will fall back to default tenant.
            if (!cancelled) setRole(null);
          }
        }
      } catch {
        if (!cancelled) {
          setMemberships([]);
          setActiveId('');
          setRole(null);
        }
      } finally {
        if (!cancelled) setBooted(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  const value = useMemo(
    () => ({
      workspaces,
      activeWorkspace,
      setActiveWorkspaceId,
      role,
    }),
    [activeWorkspace, workspaces, setActiveWorkspaceId, role]
  );

  if (!booted) return null;
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace must be used within WorkspaceProvider');
  return ctx;
}
