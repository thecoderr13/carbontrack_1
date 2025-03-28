import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL;

export const useAuthStore = create(
  persist(
    (set) => ({
      user: null,
      token: localStorage.getItem("token"),
      loading: true, // Initialize loading as true
      error: null,
      isFormComplete: false, // Track if the form is completed

      signUp: async (email, password, role, organizationName = null) => {
        set({ loading: true, error: null });
        try {
          const response = await fetch(`${API_URL}/auth/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password, role, organizationName }),
          });

          const data = await response.json();

          if (!response.ok) {
            console.error("SignUp error response:", data); // Log the error response
            throw new Error(data.message || "Signup failed");
          }

          set({
            user: data.user,
            token: data.token,
            error: null,
            loading: false,
          });

          // Save token to localStorage
          localStorage.setItem("token", data.token);

          return data;
        } catch (error) {
          console.error("SignUp error:", error.message); // Log the error for debugging
          set({ error: error.message, loading: false });
          throw error;
        }
      },

      signIn: async (email, password) => {
        set({ loading: true, error: null });
        try {
          const response = await fetch(`${API_URL}/auth/login`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify({ email, password }),
          });

          const data = await response.json();

          if (!response.ok) {
            throw new Error(data.message || "Login failed");
          }

          // Save token and user data to localStorage and state
          localStorage.setItem("token", data.token);
          set({
            user: data.user,
            token: data.token,
            error: null,
            loading: false,
          });

          return data;
        } catch (error) {
          set({ error: error.message, loading: false });
          throw error;
        }
      },

      signOut: () => {
        localStorage.removeItem("token");
        set({ user: null, token: null, loading: false, isFormComplete: false });
      },

      setUser: (user) => set({ user }),

      fetchUserData: async (url) => {
        try {
          const token = localStorage.getItem("token");
          if (!token) {
            throw new Error("No token found. Please log in again.");
          }

          const response = await axios.get(url, {
            headers: {
              Authorization: `Bearer ${token}`, // Ensure token is sent
            },
          });

          set({ user: response.data });
          return response.data;
        } catch (error) {
          console.error("Error fetching user data:", error.message);
          throw error;
        }
      },
    }),
    {
      name: "auth-storage",
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state) => {
        console.log("Rehydrating state:", state);
        if (state) {
          // Set loading to false only after rehydration is complete
          state.loading = false;
        }
      },
    }
  )
);
