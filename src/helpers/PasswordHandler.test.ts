import { PasswordHandler } from './PasswordHandler'

describe('PasswordHandler', () => {
  describe('hashPassword', () => {
    it('returns a hashedPassword string and a salt string', () => {
      const { hashedPassword, salt } = PasswordHandler.hashPassword('securepassword')

      expect(typeof hashedPassword).toBe('string')
      expect(typeof salt).toBe('string')
      expect(hashedPassword.length).toBeGreaterThan(0)
      expect(salt.length).toBeGreaterThan(0)
    })

    it('generates a unique salt on each call', () => {
      const { salt: salt1 } = PasswordHandler.hashPassword('password')
      const { salt: salt2 } = PasswordHandler.hashPassword('password')

      expect(salt1).not.toBe(salt2)
    })

    it('produces a different hash for the same password due to unique salts', () => {
      const { hashedPassword: hash1 } = PasswordHandler.hashPassword('password')
      const { hashedPassword: hash2 } = PasswordHandler.hashPassword('password')

      expect(hash1).not.toBe(hash2)
    })
  })

  describe('verifyPassword', () => {
    it('returns true when the correct password is provided', () => {
      const password = 'correctpassword'
      const { hashedPassword, salt } = PasswordHandler.hashPassword(password)

      expect(PasswordHandler.verifyPassword(password, hashedPassword, salt)).toBe(true)
    })

    it('returns false when an incorrect password is provided', () => {
      const { hashedPassword, salt } = PasswordHandler.hashPassword('correctpassword')

      expect(PasswordHandler.verifyPassword('wrongpassword', hashedPassword, salt)).toBe(false)
    })
  })
})
