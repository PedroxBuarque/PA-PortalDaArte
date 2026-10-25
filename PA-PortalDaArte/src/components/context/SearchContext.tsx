import React, { createContext, useContext, useMemo, useState } from "react";

// Texto digitado na barra de pesquisa do Header.
//
// Fica num contexto (e não na URL) para que digitar não dispare navegação:
// o campo continua montado e com foco, e a lista de Descobrir apenas reage ao
// novo texto. Apagar o texto (query = "") restaura a lista completa.

type SearchContextValue = {
  query: string;
  setQuery: (value: string) => void;
};

const SearchContext = createContext<SearchContextValue>({
  query: "",
  setQuery: () => {},
});

export function SearchProvider({ children }: { children: React.ReactNode }) {
  const [query, setQuery] = useState("");
  const value = useMemo(() => ({ query, setQuery }), [query]);
  return <SearchContext.Provider value={value}>{children}</SearchContext.Provider>;
}

export const useSearch = () => useContext(SearchContext);
