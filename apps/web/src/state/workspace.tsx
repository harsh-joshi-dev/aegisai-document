import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';

export type WorkspaceId = string;

export interface Workspace {
  id: WorkspaceId;
  name: string;
}

const WORKSPACE_NAME_KEY = 'aegis_workspace_name_v1';
const CUSTOM_WORKSPACES_KEY = 'aegis_custom_workspaces_v1';

function getPrimaryWorkspaceName() {
  try {
    return localStorage.getItem(WORKSPACE_NAME_KEY) || 'Primary Workspace';
  } catch {
    return 'Primary Workspace';
  }
}

function getCustomWorkspaces(): Workspace[] {
  try {
    const raw = localStorage.getItem(CUSTOM_WORKSPACES_KEY);
    return raw ? (JSON.parse(raw) as Workspace[]) : [];
  } catch {
    return [];
  }
}

function saveCustomWorkspaces(ws: Workspace[]) {
  try {
    localStorage.setItem(CUSTOM_WORKSPACES_KEY, JSON.stringify(ws));
  } catch {
    // ignore
  }
}

function getWorkspaces(): Workspace[] {
  const base: Workspace[] = [
    { id: 'harsh', name: getPrimaryWorkspaceName() },
    { id: 'finance', name: 'Finance' },
    { id: 'audit', name: 'Audit' },
  ];
  return [...base, ...getCustomWorkspaces()];
}

interface WorkspaceContextValue {
  workspaces: Workspace[];
  activeWorkspace: Workspace;
  setActiveWorkspaceId: (id: WorkspaceId) => void;
  createWorkspace: (name: string) => Workspace;
}

const WorkspaceContext = createContext<WorkspaceContextValue | undefined>(undefined);

const STORAGE_KEY = 'aegis_active_workspace';

function readInitialWorkspace(): Workspace {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) as WorkspaceId | null;
    const workspaces = getWorkspaces();
    const found = workspaces.find((w) => w.id === raw);
    return found ?? workspaces[0];
  } catch {
    return { id: 'harsh', name: 'Primary Workspace' };
  }
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [activeId, setActiveId] = useState<WorkspaceId>(() => readInitialWorkspace().id);
  const [customList, setCustomList] = useState<Workspace[]>(() => getCustomWorkspaces());

  const workspaces = useMemo(
    () => [
      { id: 'harsh' as const, name: getPrimaryWorkspaceName() },
      { id: 'finance' as const, name: 'Finance' },
      { id: 'audit' as const, name: 'Audit' },
      ...customList,
    ],
    [customList]
  );

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, activeId);
    } catch {
      // ignore
    }
  }, [activeId]);

  const activeWorkspace = useMemo(
    () => workspaces.find((w) => w.id === activeId) ?? workspaces[0],
    [activeId, workspaces]
  );

  const createWorkspace = (name: string) => {
    const id = `ws-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    const ws: Workspace = { id, name: name.trim() || 'New Workspace' };
    const next = [...customList, ws];
    setCustomList(next);
    saveCustomWorkspaces(next);
    return ws;
  };

  const value = useMemo(
    () => ({
      workspaces,
      activeWorkspace,
      setActiveWorkspaceId: setActiveId,
      createWorkspace,
    }),
    [activeWorkspace, workspaces]
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace must be used within WorkspaceProvider');
  return ctx;
}
