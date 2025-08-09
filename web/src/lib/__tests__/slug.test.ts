import { slugify, unslugify } from '../slug'

describe('slug utils', () => {
  test('slugify basic', () => {
    expect(slugify('Acme Solar')).toBe('acme-solar')
    expect(slugify('  Windy  Inc ')).toBe('windy-inc')
  })

  test('slugify diacritics and symbols', () => {
    expect(slugify('Énergie+Grid Co.')).toBe('energie-grid-co')
    expect(slugify('A/B\\C')).toBe('a-b-c')
  })

  test('unslugify', () => {
    expect(unslugify('acme-solar')).toBe('acme solar')
    expect(unslugify('windy-inc')).toBe('windy inc')
  })
})
