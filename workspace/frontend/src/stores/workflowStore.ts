import { create } from 'zustand'

export type WorkflowStep = 'projects' | 'data-sources' | 'editor' | 'alignment' | 'validation' | 'monitor'

type WorkflowState = {
  currentStep: WorkflowStep
  completedSteps: WorkflowStep[]
  setCurrentStep: (step: WorkflowStep) => void
  completeStep: (step: WorkflowStep) => void
  resetWorkflow: () => void
}

export const useWorkflowStore = create<WorkflowState>()((set) => ({
  currentStep: 'projects',
  completedSteps: [],
  setCurrentStep: (currentStep) => set({ currentStep }),
  completeStep: (step) =>
    set((state) => ({
      completedSteps: state.completedSteps.includes(step) ? state.completedSteps : [...state.completedSteps, step],
    })),
  resetWorkflow: () => set({ currentStep: 'projects', completedSteps: [] }),
}))
