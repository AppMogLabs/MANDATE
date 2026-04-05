/**
 * MANDATE — MegaETH Testnet Deployed Addresses
 * Chain ID: 6343
 * Deployed: 2026-03-28
 */

export const TESTNET_ADDRESSES = {
  chainId: 6343,
  rpc: 'https://carrot.megaeth.com/rpc',
  ws: 'wss://carrot.megaeth.com/ws',
  explorer: 'https://megaeth-testnet-v2.blockscout.com',

  contracts: {
    rateToken: '0x4cb785c678e309bcb86a4cfaee9feb4367985e1c',
    resourceTokenFactory: '0x59fbb6aadb231f3f14a6bbaf72f258cc59b40dee',
    resources: {
      COMPUTE: '0xDCfd00cAe10D6aC13BcDf785a9e7Ab6c6036b427',
      ENERGY: '0x5cea8086e7B62c694dcb9c707c46942f535Ab1A7',
      CHIPS: '0x82c76c6Ae247fA0597880ab5BCeC93bbcc732281',
      COOLING: '0x135D1E1Ce9295c94c9cEC63c8131bA28D20A7261',
      TALENT: '0x2E87aBc41F0dAcEa141D212424e598cE4d2881EF',
      DATA: '0xa29Bb64FAe7b103b18FC13e3E8373954058F4115',
      CLEARANCE: '0x9f37D312cb0B205e793080f33EE72731e1d4ED43',
    },
    agentRegistry: '0x60461a80d753b25fa2fd2d8e77527141110085d1',
    auditLog: '0x47458682a1ed92e55f68bbfc37f06f5bfd95e8d2',
    reputationLedger: '0x0263ace2633c4486854037c6ad05188cc832681c',
    roleRegistry: '0x2653f9621e8894cade271bbab631292c9eb6373c',
    mapRegistry: '0x59b210e9f0025a965ef862897b4e75a146b22bdc',
    buildingRegistry: '0x1802265df7c19491c271a9d07e87757f5a55fbf0',
    epochManager: '0x44bea0cfb25a42f0d80505725535e7b4bc8076ea',
    orderBook: '0x1bea07cb15cd540d463efd17bbc0dcd006344b58',
    eventOracle: '0x40d5cd8242e1ba9acd2959516ca7f14f46fd8d90',
    informationMarket: '0xbabecd94cff12c764b5034521f0f198922d55d73',
    reflexWindowManager: '0x9cfd35c726a7c3e4351e770fa952ca74a9f16fac',
    predictionMarket: '0x5e3564767994a7d2d1477bb8e391930d12470f77',
    clearanceRegistry: '0x308cda720d2a796d5970bb1346ead2be3fb4c0cc',
    complianceDriftOracle: '0xd25291237d3e5846d961c49ce97af0110edd001e',
    insurancePool: '0x2b864595ea0fc62aec5125c50d50cc01a8ac77dd',
    lineageLedger: '0x9f79140ffde18181e6c2ccbd829264fe4974599b',
    coolingRelay: '0x9ee1090bb10074dba6d48dd6c1c00fb7bd21bbf0',
    mandateEchoOracle: '0x321f14e274963877ab11e36713788b1df419f53e',
    echoVerifier: '0x92e0e3ec286713d486ee4b06aba00292d9bdde1c',
    guardClauseMarketplace: '0xa8a1aaee91b05b09917ecb5ff51f5a576fb8182d',
    negotiationSettlement: '0x23173b46e27bbc2117ef2bfc56c1cbe573c3d4a9',
    hedgeFactory: '0xf8fc66aae6002d7ebcd98abd56d46b7629e34322',
    epochRewardManager: '0x88186f32938fa8708ad717fb03e70ffa6686e913',
    rentCollector: '0x05060a0feef6fcaca7f896a405f1fb87a7773155',
    // Phase 6: Player onboarding (deployed 2026-04-03)
    playerOnboarding: '0x77EC9115f982c6e48eB5701d3b7ad114c973B539',
  },
} as const;
