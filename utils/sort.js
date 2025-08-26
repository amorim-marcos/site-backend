/**
 * Retorna a query de ordenação para custom_order + created_at
 * Pode ser usada em qualquer model que possua esses campos
 * @param {object} qb - QueryBuilder do Bookshelf/Knex
 */
function orderByCustomOrderAndCreatedAt(qb) {
  qb.orderByRaw("custom_order IS NULL, custom_order ASC, created_at DESC");
}

module.exports = { orderByCustomOrderAndCreatedAt };