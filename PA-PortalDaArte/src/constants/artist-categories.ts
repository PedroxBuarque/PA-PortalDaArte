// Categorias principais que o Perfil do Artista oferece. É a ÚNICA definição desta lista:
// o Perfil (escolha da categoria principal) e o filtro de Descobrir importam daqui.
//
// As categorias personalizadas ("Categorias e estilos" do Perfil) não ficam aqui: são gravadas no
// banco (tabelas categorias / artista_categorias) e o Descobrir as descobre pelos dados da API.

export const PROFILE_CATEGORIES = [
  "Música • Violão e Voz",
  "Música • Banda Completa",
  "Música • DJ & Produção",
  "Música • Acústico / MPB",
  "Performance • Eventos e Casamentos",
  "Outros • Artista Independente",
];

/** Chave para comparar categorias sem diferenciar acentos, maiúsculas e espaços repetidos. */
export const categoryKey = (name: string): string =>
  String(name ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

/**
 * Monta as opções do filtro de categoria: primeiro as do Perfil (na ordem dele), depois as que
 * existem nos dados dos artistas (personalizadas), sem repetir e em ordem alfabética.
 */
export function buildCategoryOptions(artistCategoryNames: string[][]): string[] {
  const options: string[] = [];
  const seen = new Set<string>();
  const add = (name: string) => {
    const label = String(name ?? "").replace(/\s+/g, " ").trim();
    const key = categoryKey(label);
    if (!key || seen.has(key)) return;
    seen.add(key);
    options.push(label);
  };
  PROFILE_CATEGORIES.forEach(add);
  const extra: string[] = [];
  const before = options.length;
  artistCategoryNames.flat().forEach(add);
  extra.push(...options.splice(before));
  extra.sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }));
  return [...options, ...extra];
}
