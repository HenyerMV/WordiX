// Qué fuentes externas sirven para confirmar cada categoría.
// Para agregar o corregir una categoría solo hay que tocar este archivo.
//
//  - wikidata: clases de Wikidata (QID). Una palabra se acepta si existe en Wikidata
//    con ese nombre en español y está POR DEBAJO de alguna de estas clases
//    (instancia de, subclase de o taxón dentro de ella).
//  - wiktionary: patrones de las categorías de la entrada en es.wiktionary.org.
//    Se acepta si la entrada existe y pertenece a una categoría que coincide.
//
// Regla de oro: las fuentes solo pueden ACEPTAR. Si no confirman (o fallan), la
// respuesta pasa a revisión grupal; nunca se rechaza por falta de datos.

export interface CategoryRule {
  wikidata?: string[];
  wiktionary?: RegExp[];
}

export const CATEGORY_RULES: Record<string, CategoryRule> = {
  animal: {
    wikidata: ["Q729"], // animal (reino Animalia)
    wiktionary: [/animales|mam[ií]feros|\baves\b|peces|reptiles|anfibios|insectos|ar[aá]cnidos|moluscos|crust[aá]ceos/i],
  },
  nombre: {
    wikidata: ["Q202444"], // nombre de pila
    wiktionary: [/nombres (masculinos|femeninos|propios de persona|de pila)/i],
  },
  apellido: {
    wikidata: ["Q101352"], // apellido
    wiktionary: [/apellidos/i],
  },
  pais_ciudad: {
    wikidata: ["Q6256", "Q486972"], // país, asentamiento humano (ciudades, pueblos…)
    wiktionary: [/pa[ií]ses|ciudades|localidades|capitales/i],
  },
  fruta: {
    wikidata: ["Q3314483"], // fruta
    wiktionary: [/frutas|frutos/i],
  },
  color: {
    wikidata: ["Q1075"], // color
    wiktionary: [/colores/i],
  },
  comida: {
    wikidata: ["Q2095", "Q746549"], // alimento, plato
    wiktionary: [/alimentos|comidas|gastronom[ií]a|platos/i],
  },
  objeto: {
    wikidata: ["Q223557"], // objeto físico
    wiktionary: [/objetos|utensilios|herramientas|muebles|instrumentos/i],
  },
  profesion: {
    wikidata: ["Q28640", "Q12737077"], // profesión, ocupación
    wiktionary: [/profesiones|ocupaciones|oficios/i],
  },
  pelicula: {
    wikidata: ["Q11424", "Q5398426", "Q15416", "Q24856"], // película, serie de TV, programa de TV, saga
  },
  cuerpo: {
    wikidata: ["Q4936952"], // estructura anatómica
    wiktionary: [/anatom[ií]a|cuerpo humano|[oó]rganos|huesos|m[uú]sculos/i],
  },
  personaje: {
    wikidata: ["Q95074", "Q5"], // personaje de ficción, ser humano
  },
  cancion: {
    wikidata: ["Q7366", "Q134556"], // canción, sencillo
  },
  deporte: {
    wikidata: ["Q349"], // deporte
    wiktionary: [/deportes/i],
  },
};
