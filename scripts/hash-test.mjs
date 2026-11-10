// Test vectors generated from the REAL @nimiq/core 2.23.0 (official Nimiq JS SDK).
// Uses its public API only: PrivateKey -> KeyPair -> Address -> toUserFriendlyAddress().
import * as Nimiq from '@nimiq/core';

const vectors = [];
for (const seedByte of [0, 1, 42, 255]) {
    const privateKey = new Nimiq.PrivateKey(new Uint8Array(32).fill(seedByte));
    const keyPair = Nimiq.KeyPair.derive(privateKey);
    const address = keyPair.publicKey.toAddress();
    vectors.push({ seedByte, address: address.toUserFriendlyAddress() });
}
// The known example address from the official API reference docs (all-zero payload):
vectors.push({ seedByte: 'doc', address: 'NQ07 0000 0000 0000 0000 0000 0000 0000 0000' });
console.log(JSON.stringify(vectors, null, 2));
