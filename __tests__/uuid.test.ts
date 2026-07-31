import { generarUUID } from '../src/utils/uuid';

describe('generarUUID', () => {
  it('genera un UUID v4 válido', () => {
    const id = generarUUID();
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    );
  });

  it('genera IDs únicos', () => {
    const ids = new Set(Array.from({ length: 1000 }, () => generarUUID()));
    expect(ids.size).toBe(1000);
  });
});
