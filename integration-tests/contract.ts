import {
  MsgStoreCode,
  MsgInstantiateContract,
  MsgExecuteContract,
  isTxError,
  LocalPaloma,
  getCodeId,
  getContractAddress,
} from '../src';
import { AccessConfig, AccessType } from '../src/core/wasm/AccessConfig';
import * as fs from 'fs';

const isLegacy = false;
const paloma = new LocalPaloma(isLegacy);

// test1 key from localpaloma accounts
const { test1 } = paloma.wallets;

async function main(): Promise<void> {
  const storeCode = new MsgStoreCode(
    test1.key.accAddress,
    fs.readFileSync(isLegacy ? 'contract.wasm.7' : 'contract.wasm.8').toString('base64'),
    isLegacy ? undefined : new AccessConfig(AccessType.ACCESS_TYPE_EVERYBODY, "")
  );
  const storeCodeTx = await test1.createAndSignTx({
    msgs: [storeCode],
  });
  const storeCodeTxResult = await paloma.tx.broadcastBlock(storeCodeTx);

  console.log(storeCodeTxResult);

  if (isTxError(storeCodeTxResult)) {
    throw new Error(
      `store code failed. code: ${storeCodeTxResult.code}, codespace: ${storeCodeTxResult.codespace}, raw_log: ${storeCodeTxResult.raw_log}`
    );
  }

  const codeId = getCodeId(storeCodeTxResult);

  const instantiate = new MsgInstantiateContract(
    test1.key.accAddress,
    undefined,
    +codeId, // code ID
    { count: 0, }, // InitMsg
    { uluna: 1000000 }, // init coins
    "testlabel",
  );

  const instantiateTx = await test1.createAndSignTx({
    msgs: [instantiate],
  });
  const instantiateTxResult = await paloma.tx.broadcastBlock(instantiateTx);

  console.log(instantiateTxResult);

  if (isTxError(instantiateTxResult)) {
    throw new Error(
      `instantiate failed. code: ${instantiateTxResult.code}, codespace: ${instantiateTxResult.codespace}, raw_log: ${instantiateTxResult.raw_log}`
    );
  }

  const contractAddress = getContractAddress(instantiateTxResult, 0, isLegacy);

  const execute = new MsgExecuteContract(
    test1.key.accAddress, // sender
    contractAddress, // contract address
    { increment: {} }, // handle msg
    { uluna: 100000 } // coins
  );
  const executeTx = await test1.createAndSignTx({
    msgs: [execute],
  });
  const executeTxResult = await paloma.tx.broadcastBlock(executeTx);
  console.log(executeTxResult);

  console.log(await paloma.wasm.contractQuery(contractAddress, { "get_count": {} }));

  const [history, _] = await paloma.wasm.contractHistory(contractAddress);
  console.log(history.map(h => h.toData()));
  console.log(JSON.stringify(await paloma.wasm.contractInfo(contractAddress)));
  console.log(JSON.stringify(await paloma.wasm.codeInfo(+codeId)));

}

main().then(console.log).catch(console.log)
