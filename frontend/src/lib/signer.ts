
// Compatible signer for substrate-contracts-node v0.41.0
export async function getAliceSigner() {
  const { Keyring } = await import("@polkadot/keyring");
  const { u8aToHex } = await import("@polkadot/util");
  const { signatureVerify } = await import("@polkadot/util-crypto");
  
  const kr = new Keyring({ type: "sr25519", ss58Format: 42 });
  const alice = kr.addFromUri("//Alice");
  
  return {
    address: alice.address,
    signer: {
      signPayload: async (payload: any) => {
        const { u8aToHex } = await import("@polkadot/util");
        const { blake2AsU8a } = await import("@polkadot/util-crypto");
        
        // Sign the raw payload data
        const data = payload.data;
        const dataU8a = data.startsWith("0x") 
          ? Buffer.from(data.slice(2), "hex")
          : Buffer.from(data);
          
        // For large payloads, substrate signs the blake2 hash
        const toSign = dataU8a.length > 256 
          ? blake2AsU8a(dataU8a) 
          : dataU8a;
          
        const signature = alice.sign(toSign, { withType: true });
        return {
          id: payload.id,
          signature: u8aToHex(signature),
        };
      },
    },
  };
}

export async function getBobSigner() {
  const { Keyring } = await import("@polkadot/keyring");
  const { u8aToHex } = await import("@polkadot/util");
  const { blake2AsU8a } = await import("@polkadot/util-crypto");
  
  const kr = new Keyring({ type: "sr25519", ss58Format: 42 });
  const bob = kr.addFromUri("//Bob");
  
  return {
    address: bob.address,
    signer: {
      signPayload: async (payload: any) => {
        const data = payload.data;
        const dataU8a = data.startsWith("0x")
          ? Buffer.from(data.slice(2), "hex")
          : Buffer.from(data);
        const toSign = dataU8a.length > 256
          ? blake2AsU8a(dataU8a)
          : dataU8a;
        const signature = bob.sign(toSign, { withType: true });
        return { id: payload.id, signature: u8aToHex(signature) };
      },
    },
  };
}
