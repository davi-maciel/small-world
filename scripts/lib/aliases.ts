// Slug aliases: maps variant slugs to the canonical slug.
// Format: [variant] -> canonical
export const SLUG_ALIASES: Record<string, string> = {
  // 2005: abbreviated names in supp → full names from unofficial
  "andre-fernando-de-c-silva": "andre-fernando-de-castro-da-silva",
  "aron-a-heleodoro": "heleodoro-aaron-alexandre",
  "jose-mario-da-s-filho": "jose-mario-silva-filho",

  // 2006: typo "Reboulgas" in unofficial → correct "Rebouças" in supp
  "renato-reboulgas-de-medeiros": "renato-reboucas-de-medeiros",

  // 2007: abbreviated "Thomas F. Lima" in unofficial → full name in supp
  "thomas-f-lima": "thomas-ferreira-de-lima",

  // 2008: typo "Carvina" in supp → correct "Cavina" in unofficial
  "rafael-parpinel-carvina": "rafael-parpinel-cavina",

  // 2009: typo "Guilhom" in supp → correct "Guilhon" in unofficial
  "ivan-guilhom-mitoso-rocha": "ivan-guilhon-mitoso-rocha",

  // 2010-2011: abbreviated names in unofficial → full names in supp
  "gustavo-haddad-fs-braga": "gustavo-haddad-francisco-e-sampaio-braga",
  "cassio-sousa": "cassio-dos-santos-sousa",
  "rodrigo-alencar": "rodrigo-rolim-mendes-de-alencar",

  // 2010: typo "Rudrigues" in supp → correct "Rodrigues" in unofficial
  "filipe-rudrigues-de-almeida-lira": "filipe-rodrigues-de-almeida-lira",

  // 2011: abbreviated "José Godoi Alves" in unofficial → full name in supp
  "jose-godoi-alves": "jose-guilherme-godoi-alves",

  // EuPhO: "Gabriel Trigo" in 2018 PDF is "Gabriel Guerra Trigo"
  "gabriel-trigo": "gabriel-guerra-trigo",

  // OIbF: "Gabriel Mazzili Pedroza" (double z) → canonical "Mazili" (single z) from EuPhO
  "gabriel-mazzili-pedroza": "gabriel-mazili-pedroza",

  // EuPhO 2017: "Diogo Netto" is "Diogo Correia Netto" from IPhO
  "diogo-netto": "diogo-correia-netto",

  // NBPhO 2020: "Maria Freitas" in PDF is "Maria Eduarda Gonçalves Freitas" from OIbF
  // (not needed if raw data uses full name, but kept for reference)
};

// Preferred display names for canonical slugs
export const PREFERRED_NAMES: Record<string, string> = {
  "andre-fernando-de-castro-da-silva": "André Fernando de Castro da Silva",
  "heleodoro-aaron-alexandre": "Heleodoro Aaron Alexandre",
  "jose-mario-silva-filho": "José Mário Silva Filho",
  "renato-reboucas-de-medeiros": "Renato Rebouças de Medeiros",
  "thomas-ferreira-de-lima": "Thomás Ferreira de Lima",
  "rafael-parpinel-cavina": "Rafael Parpinel Cavina",
  "ivan-guilhon-mitoso-rocha": "Ivan Guilhon Mitoso Rocha",
  "gustavo-haddad-francisco-e-sampaio-braga":
    "Gustavo Haddad Francisco e Sampaio Braga",
  "cassio-dos-santos-sousa": "Cássio dos Santos Sousa",
  "filipe-rodrigues-de-almeida-lira": "Filipe Rodrigues de Almeida Lira",
  "rodrigo-rolim-mendes-de-alencar": "Rodrigo Rolim Mendes de Alencar",
  "jose-guilherme-godoi-alves": "José Guilherme Godoi Alves",
  "gabriel-guerra-trigo": "Gabriel Guerra Trigo",
  // Diacritics from SCRAPING_PLAN known names
  "alicia-duarte-silva": "Alícia Duarte Silva",
  "lua-de-souza-santos": "Luã de Souza Santos",
  "joao-gabriel-pepato-de-oliveira": "João Gabriel Pepato de Oliveira",
  "gabriel-hemetrio-de-menezes": "Gabriel Hemétrio de Menezes",
  "luiz-claudio-germano-da-costa": "Luiz Cláudio Germano Da Costa",
  // NBPhO: diacritics from SBF / known Portuguese names
  "antonio-italo-lima-lopes": "Antônio Ítalo Lima Lopes",
  "andre-senas-bonfadini-araujo": "André Senas Bonfadini Araujo",
  "jose-ulisses-fonseca-mendonca": "José Ulisses Fonseca Mendonça",
  "sergio-carneiro-bittencourt": "Sérgio Carneiro Bittencourt",
};
