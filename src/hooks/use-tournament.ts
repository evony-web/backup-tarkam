'use client'

import { create } from 'zustand'

export type DivisionTab = 'SEMUA' | 'MALE' | 'FEMALE'

interface TournamentState {
  activeTab: DivisionTab
  setActiveTab: (tab: DivisionTab) => void
  adminOpen: boolean
  setAdminOpen: (open: boolean) => void
  selectedTournamentId: string | null
  setSelectedTournamentId: (id: string | null) => void
}

export const useTournament = create<TournamentState>((set) => ({
  activeTab: 'SEMUA',
  setActiveTab: (tab) => set({ activeTab: tab }),
  adminOpen: false,
  setAdminOpen: (open) => set({ adminOpen: open }),
  selectedTournamentId: null,
  setSelectedTournamentId: (id) => set({ selectedTournamentId: id }),
}))

// Also export as useTournamentStore for backward compatibility
export const useTournamentStore = useTournament
