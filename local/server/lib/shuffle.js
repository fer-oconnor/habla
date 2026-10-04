// ---------------------------------------------------------------------------
// Mezcla DETERMINISTA.
//
// Por que no Math.random(): las opciones tienen que salir siempre en el mismo
// orden para un ejercicio dado. Si cambiaran en cada peticion, al recargar la
// pagina el alumno veria las opciones movidas y la respuesta que ya envio
// dejaria de coincidir visualmente.
//
// La semilla es el id del ejercicio, asi que:
//   * cada ejercicio tiene su propio orden (la correcta no es siempre la 1a)
//   * ese orden no cambia nunca, ni al recargar ni al reiniciar el servidor
// ---------------------------------------------------------------------------

/** Generador congruencial lineal: rapido, suficiente y reproducible. */
function makeRandom(seed) {
  let state = 0;
  for (const char of String(seed)) {
    state = (state * 31 + char.charCodeAt(0)) % 2147483647;
  }
  if (state <= 0) state += 2147483646;
  return () => {
    state = (state * 48271) % 2147483647;
    return state / 2147483647;
  };
}

export function seededShuffle(items, seed) {
  const list = [...items];
  const random = makeRandom(seed);
  for (let index = list.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [list[index], list[swap]] = [list[swap], list[index]];
  }
  return list;
}
