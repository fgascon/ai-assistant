export class XorEncryption {
  private static readonly INITIALIZATION_VECTOR: number = 171;

  private static *xorPayload(
    unencrypted: Uint8Array,
  ): Generator<number, void, unknown> {
    let key = XorEncryption.INITIALIZATION_VECTOR;
    for (const unencryptedByte of unencrypted) {
      key = key ^ unencryptedByte;
      yield key;
    }
  }

  public static encrypt(request: string): Uint8Array {
    /** Encrypt a request for a TP-Link Smart Home Device.
     *
     * @param request - plaintext request data
     * @return ciphertext to be sent over wire, in bytes
     */
    const plainBytes = new TextEncoder().encode(request);
    const lengthBuffer = new ArrayBuffer(4);
    new DataView(lengthBuffer).setUint32(0, plainBytes.length, false);
    const lengthBytes = new Uint8Array(lengthBuffer);
    const encryptedPayload = new Uint8Array([
      ...lengthBytes,
      ...Array.from(XorEncryption.xorPayload(plainBytes)),
    ]);
    return encryptedPayload;
  }

  private static *xorEncryptedPayload(
    ciphertext: Uint8Array,
  ): Generator<number, void, unknown> {
    let key = XorEncryption.INITIALIZATION_VECTOR;
    for (const cipherByte of ciphertext) {
      const plainByte = key ^ cipherByte;
      key = cipherByte;
      yield plainByte;
    }
  }

  public static decrypt(ciphertext: Uint8Array): string {
    /** Decrypt a response of a TP-Link Smart Home Device.
     *
     * @param ciphertext - encrypted response data
     * @return plaintext response
     */
    const decryptedBytes = new Uint8Array(
      Array.from(XorEncryption.xorEncryptedPayload(ciphertext)),
    );

    return new TextDecoder().decode(decryptedBytes);
  }
}
