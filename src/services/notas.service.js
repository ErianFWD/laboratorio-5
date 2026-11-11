const { randomUUID } = require('node:crypto');
const { AppError } = require('../utils/app-error');

function createNotasService() {
  const notas = new Map();

  function obtener(id) {
    const nota = notas.get(id);
    if (!nota) {
      throw new AppError(404, 'NOTA_NO_ENCONTRADA', 'La nota no existe.');
    }
    return { ...nota };
  }

  return {
    listar: () => Array.from(notas.values(), (nota) => ({ ...nota })),
    obtener,
    crear({ titulo, contenido }) {
      const nota = { id: randomUUID(), titulo, contenido };
      notas.set(nota.id, nota);
      return { ...nota };
    },
    eliminar(id) {
      obtener(id);
      notas.delete(id);
    },
  };
}

module.exports = { createNotasService };
