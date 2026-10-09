import React, { createContext, useContext, useEffect, useState } from "react";
import { Platform } from "react-native";

// O erro estava aqui: removido o <any> para ficar apenas createContext(null)
const ProfileContext = createContext(null);

const STORAGE_KEY = "pa-portal-da-arte-profile";

const DEFAULT_PROFILE = {
  profileImage: null,
  profileName: "Clara Mendonça",
  location: "Caruaru, PE",
  profileCategory: "Música • Violão e Voz",
  bio: "Artista e cantora apaixonada por música brasileira. Trabalho com apresentações acústicas, eventos, casamentos e apresentações particulares.",
  email: "",
  password: "",
  docType: "",
  docNumber: "",
  state: "",
  city: "",
};

export function ProfileProvider({ children }) {
  const [profile, setProfile] = useState(DEFAULT_PROFILE);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        if (Platform.OS === "web") {
          const saved = window.localStorage.getItem(STORAGE_KEY);
          if (saved) {
            setProfile({ ...DEFAULT_PROFILE, ...JSON.parse(saved) });
          }
        }
      } catch (error) {
        console.error("Erro ao carregar dados do perfil:", error);
      }
    };

    loadProfile();
  }, []);

  const persistProfile = (nextProfile) => {
    setProfile(nextProfile);

    try {
      if (Platform.OS === "web") {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextProfile));
      }
    } catch (error) {
      console.error("Erro ao salvar dados do perfil:", error);
    }
  };

  const updateProfile = (changes) => {
    persistProfile({ ...profile, ...changes });
  };

  const saveRegistration = ({
    email,
    fullName,
    password,
    docType,
    docNumber,
    state,
    city,
  }) => {
    persistProfile({
      ...profile,
      email: email.trim().toLowerCase(),
      password,
      profileName: fullName.trim(),
      docType,
      docNumber,
      state,
      city,
      location: `${city}, ${state}`,
    });
  };

  const saveProfileImage = async (uri) => {
    persistProfile({ ...profile, profileImage: uri || null });
  };

  const resetPassword = (newPassword) => {
    persistProfile({ ...profile, password: newPassword });
  };

  return (
    <ProfileContext.Provider
      value={{
        ...profile,
        saveProfileImage,
        updateProfile,
        saveRegistration,
        resetPassword,
      }}
    >
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  const context = useContext(ProfileContext);

  if (!context) {
    throw new Error("useProfile deve ser usado dentro de ProfileProvider");
  }

  return context;
}
