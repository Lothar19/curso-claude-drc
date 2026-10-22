/**
 * Traduce el error HTTP de la API de mesas a un texto en español.
 * La API devuelve `{ error: <NombreDeClase>, message: <inglés> }`: se decide por el nombre de la clase.
 */
const TABLE_ERROR_MESSAGES: Record<string, string> = {
  TableNotFoundError: 'La mesa no existe o ya fue eliminada.',
  RestaurantNotFoundError: 'El restaurante no existe.',
  RestaurantIdRequiredError: 'Falta el identificador del restaurante.',
  DuplicatedTableNumberError: 'Ya existe una mesa con ese número en este restaurante.',
  TableInUseError: 'No se puede eliminar una mesa ocupada. Cambia su estado a libre antes de borrarla.',
  InvalidTableNumberError: 'El número de mesa debe ser un entero mayor que 0.',
  InvalidTableCapacityError: 'La capacidad debe ser un entero mayor que 0.',
  InvalidTableStatusError: 'El estado de la mesa no es válido.'
}

export function getTableErrorMessage(err: unknown, fallback: string): string {
  const errorName = (err as { error?: { error?: unknown } } | null)?.error?.error
  if (typeof errorName === 'string' && errorName in TABLE_ERROR_MESSAGES) {
    return TABLE_ERROR_MESSAGES[errorName]
  }
  return fallback
}
