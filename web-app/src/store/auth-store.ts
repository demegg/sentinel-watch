"use client";

import { create } from "zustand";
import {
  getCurrentUser,
  loadPlaces,
  markOnboardingDone,
  newId,
  publicUser,
  savePlaces,
  signIn as storageSignIn,
  signOut as storageSignOut,
  signUp as storageSignUp,
  type SavedPlace,
} from "@/lib/auth-storage";

export type PublicUser = {
  email: string;
  name: string;
  onboardingDone: boolean;
  createdAt: number;
};

interface AuthStore {
  hydrated: boolean;
  user: PublicUser | null;
  places: SavedPlace[];
  hydrate: () => void;
  signUp: (opts: {
    email: string;
    password: string;
    name: string;
  }) => Promise<{ ok: true } | { ok: false; error: string }>;
  signIn: (opts: {
    email: string;
    password: string;
  }) => Promise<{ ok: true } | { ok: false; error: string }>;
  signOut: () => void;
  completeOnboarding: (places: SavedPlace[]) => void;
  setPlaces: (places: SavedPlace[]) => void;
  addPlace: (place: Omit<SavedPlace, "id" | "addedAt">) => void;
  removePlace: (id: string) => void;
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  hydrated: false,
  user: null,
  places: [],

  hydrate: () => {
    const user = getCurrentUser();
    if (!user) {
      set({ hydrated: true, user: null, places: [] });
      return;
    }
    set({
      hydrated: true,
      user: publicUser(user),
      places: loadPlaces(user.email),
    });
  },

  signUp: async (opts) => {
    const res = await storageSignUp(opts);
    if (!res.ok) return res;
    set({ user: publicUser(res.user), places: [] });
    return { ok: true };
  },

  signIn: async (opts) => {
    const res = await storageSignIn(opts);
    if (!res.ok) return res;
    set({
      user: publicUser(res.user),
      places: loadPlaces(res.user.email),
    });
    return { ok: true };
  },

  signOut: () => {
    storageSignOut();
    set({ user: null, places: [] });
  },

  completeOnboarding: (places) => {
    const { user } = get();
    if (!user) return;
    markOnboardingDone(user.email);
    savePlaces(user.email, places);
    set({
      user: { ...user, onboardingDone: true },
      places,
    });
  },

  setPlaces: (places) => {
    const { user } = get();
    if (!user) return;
    savePlaces(user.email, places);
    set({ places });
  },

  addPlace: (place) => {
    const { user, places } = get();
    if (!user) return;
    if (places.length >= 8) return;
    const dup = places.some(
      (p) => Math.abs(p.lat - place.lat) < 0.05 && Math.abs(p.lng - place.lng) < 0.05
    );
    if (dup) return;
    const next: SavedPlace[] = [
      ...places,
      {
        ...place,
        id: newId("place"),
        addedAt: Date.now(),
      },
    ];
    savePlaces(user.email, next);
    set({ places: next });
  },

  removePlace: (id) => {
    const { user, places } = get();
    if (!user) return;
    const next = places.filter((p) => p.id !== id);
    savePlaces(user.email, next);
    set({ places: next });
  },
}));
