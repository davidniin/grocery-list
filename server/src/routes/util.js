// El cuerpo JSON de la petición, o null si no hay o no es JSON válido
export async function readJson(c) {
  try { return await c.req.json(); } catch { return null; }
}
