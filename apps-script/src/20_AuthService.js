/**
 * AuthService — autenticación de dos vías (docs/01-modelo-datos.md → Auth).
 *
 *  - Email único en Users  → identify() resuelve en modo DIRECT, sin PIN.
 *  - Email compartido      → identify() devuelve candidatos; el cliente
 *    llama loginWithPin(loginId, pin) para completar el login y recibe un
 *    token firmado (solo esta vía necesita token: la vía DIRECT se resuelve
 *    en cada llamada con Session.getActiveUser(), sin estado propio).
 */
var AuthService = {
  PIN_PATTERN: /^\d{4}$/,

  identify: function (email) {
    var matches = new UsersRepository().findByEmail(email);
    if (matches.length === 0) {
      return { mode: 'DENIED', reason: 'NO_USER_FOR_EMAIL' };
    }
    if (matches.length === 1) {
      return { mode: 'DIRECT', user: this._publicUser(matches[0]) };
    }
    return {
      mode: 'SELECT_PIN',
      candidates: matches.map(function (user) {
        return {
          userId: user['User ID'],
          loginId: user['Login ID'],
          nombreCorto: user['Nombre Corto']
        };
      })
    };
  },

  emailRequiresPin: function (email) {
    return new UsersRepository().findByEmail(email).length > 1;
  },

  loginWithPin: function (loginId, pin) {
    if (!this.PIN_PATTERN.test(String(pin))) {
      throw new Error('PIN inválido: debe ser de 4 dígitos.');
    }
    var user = new UsersRepository().findByLoginId(loginId);
    if (!user || user.Activo === false) {
      throw new Error('Usuario no encontrado o inactivo.');
    }
    var creds = new AuthCredentialsRepository().findByUserId(user['User ID']);
    if (!creds) {
      throw new Error('El usuario no tiene PIN configurado. Debe pedir a un Admin que se lo asigne.');
    }
    var computed = this._hashPin(pin, creds.Salt);
    if (computed !== creds['PIN Hash']) {
      throw new Error('PIN incorrecto.');
    }
    return this._issueToken(user['User ID']);
  },

  resolveCurrentUser: function (token) {
    if (token) {
      var userId = this._verifyToken(token);
      return new UsersRepository().findById(userId);
    }
    var email = Session.getActiveUser().getEmail();
    var result = this.identify(email);
    if (result.mode !== 'DIRECT') {
      throw new Error('Este correo requiere seleccionar usuario y PIN (email compartido).');
    }
    return new UsersRepository().findById(result.user.userId);
  },

  resetPin: function (adminUserId, targetUserId, newPin) {
    if (!PermissionService.isAdmin(adminUserId)) {
      throw new Error('Solo un usuario con rol Admin puede reiniciar un PIN.');
    }
    if (!this.PIN_PATTERN.test(String(newPin))) {
      throw new Error('PIN inválido: debe ser de 4 dígitos.');
    }
    var salt = Utilities.getUuid();
    var hash = this._hashPin(newPin, salt);
    new AuthCredentialsRepository().upsert(targetUserId, hash, salt);
  },

  // Solo para bootstrapTestEnvironment() — nunca expuesto vía API pública.
  // La vía de producción para asignar/cambiar un PIN es resetPin (Admin).
  seedPinForTesting: function (userId, pin) {
    var salt = Utilities.getUuid();
    var hash = this._hashPin(pin, salt);
    new AuthCredentialsRepository().upsert(userId, hash, salt);
  },

  _publicUser: function (user) {
    return { userId: user['User ID'], nombreCorto: user['Nombre Corto'] };
  },

  _hashPin: function (pin, salt) {
    var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(pin) + ':' + salt);
    return digest
      .map(function (byte) {
        var unsigned = byte < 0 ? byte + 256 : byte;
        var hex = unsigned.toString(16);
        return hex.length === 1 ? '0' + hex : hex;
      })
      .join('');
  },

  _issueToken: function (userId) {
    var payload = JSON.stringify({
      sub: userId,
      iat: Date.now(),
      exp: Date.now() + 12 * 60 * 60 * 1000
    });
    var payloadB64 = Utilities.base64EncodeWebSafe(payload);
    var signature = Utilities.computeHmacSha256Signature(payloadB64, Config.getSessionSecret());
    var signatureB64 = Utilities.base64EncodeWebSafe(signature);
    return payloadB64 + '.' + signatureB64;
  },

  _verifyToken: function (token) {
    var parts = String(token).split('.');
    if (parts.length !== 2) {
      throw new Error('Token de sesión inválido.');
    }
    var payloadB64 = parts[0];
    var signatureB64 = parts[1];
    var expectedSignature = Utilities.base64EncodeWebSafe(
      Utilities.computeHmacSha256Signature(payloadB64, Config.getSessionSecret())
    );
    if (expectedSignature !== signatureB64) {
      throw new Error('Token de sesión inválido.');
    }
    var payload = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(payloadB64)).getDataAsString());
    if (payload.exp < Date.now()) {
      throw new Error('La sesión expiró, vuelve a iniciar sesión.');
    }
    return payload.sub;
  }
};
