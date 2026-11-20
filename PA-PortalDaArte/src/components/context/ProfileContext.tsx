import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState, type PropsWithChildren } from "react";

const STORAGE_KEY = "pa-portal-da-arte-profile";

type ProfileState = {
  profileImage: string | null;
  profileName: string;
  location: string;
  profileCategory: string;
  bio: string;
  email: string;
  password: string;
  docType: string;
  docNumber: string;
  state: string;
  city: string;
};

type RegistrationInput = {
  email: string;
  fullName: string;
  password: string;
  docType: string;
  docNumber: string;
  state: string;
  city: string;
};

type ProfileContextValue = ProfileState & {
  saveProfileImage: (uri: string | null) => Promise<void>;
  updateProfile: (changes: Partial<ProfileState>) => void;
  saveRegistration: (input: RegistrationInput) => void;
  resetPassword: (newPassword: string) => void;
};

const ProfileContext = createContext<ProfileContextValue | null>(null);

const DEFAULT_PROFILE: ProfileState = {
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

export function ProfileProvider({ children }: PropsWithChildren) {
  const [profile, setProfile] = useState<ProfileState>(DEFAULT_PROFILE);

  useEffect(() => {
    let active = true;

    const loadProfile = async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (!active || !saved) return;
        const parsed = JSON.parse(saved) as Partial<ProfileState>;
        setProfile({ ...DEFAULT_PROFILE, ...parsed });
      } catch (error) {
        console.error("Erro ao carregar dados do perfil:", error);
      }
    };

    void loadProfile();
    return () => {
      active = false;
    };
  }, []);

  const persistProfile = (nextProfile: ProfileState) => {
    setProfile(nextProfile);
    void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(nextProfile)).catch((error) => {
      console.error("Erro ao salvar dados do perfil:", error);
    });
  };

  const updateProfile = (changes: Partial<ProfileState>) => {
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
  }: RegistrationInput) => {
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

  const saveProfileImage = async (uri: string | null) => {
    persistProfile({ ...profile, profileImage: uri || null });
  };

  const resetPassword = (newPassword: string) => {
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

export function useProfile(): ProfileContextValue {
  const context = useContext(ProfileContext);

  if (!context) {
    throw new Error("useProfile deve ser usado dentro de ProfileProvider");
  }

  return context;
}
