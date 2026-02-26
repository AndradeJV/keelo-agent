import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Organization, Project } from './api';

interface WorkspaceState {
  // Current selections
  currentOrg: Organization | null;
  currentProject: Project | null;
  
  // Lists
  organizations: Organization[];
  projects: Project[];
  
  // Loading
  loading: boolean;

  // Actions
  setCurrentOrg: (org: Organization | null) => void;
  setCurrentProject: (project: Project | null) => void;
  setOrganizations: (orgs: Organization[]) => void;
  setProjects: (projects: Project[]) => void;
  setLoading: (loading: boolean) => void;
  reset: () => void;
}

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set) => ({
      currentOrg: null,
      currentProject: null,
      organizations: [],
      projects: [],
      loading: false,

      setCurrentOrg: (org) => set({ currentOrg: org, currentProject: null, projects: [] }),
      setCurrentProject: (project) => set({ currentProject: project }),
      setOrganizations: (orgs) => set({ organizations: orgs }),
      setProjects: (projects) => set({ projects }),
      setLoading: (loading) => set({ loading }),
      reset: () => set({
        currentOrg: null,
        currentProject: null,
        organizations: [],
        projects: [],
        loading: false,
      }),
    }),
    {
      name: 'keelo-workspace',
      partialize: (state) => ({
        currentOrg: state.currentOrg,
        currentProject: state.currentProject,
      }),
    }
  )
);

