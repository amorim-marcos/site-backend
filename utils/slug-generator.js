"use strict";

/**
 * Recebe um texto e gera um slug limpo, removendo acentos, caracteres especiais e mantendo apenas letras, números, espaços e hífens.
 * Preserva caracteres chineses.
 * @param {string} text - Texto para converter
 * @returns {string} Slug
 * @example
 * generateSlug("Olá Mundo! 123"); // "ola-mundo-123"
 * generateSlug("你好世界"); // "你好世界"
 */
function generateSlug(text) {
  if (!text) return "";

  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove acentos
    .replace(/[^\w\u4e00-\u9fff\s-]/g, "") // Mantém ASCII + chinês + espaços + hífens
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

module.exports = { generateSlug };
