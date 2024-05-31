import { ProofData, BarretenbergVerifier as Verifier } from '@noir-lang/backend_barretenberg';
import * as fs from 'fs';

import { parseArgs } from "util";

const { values, positionals } = parseArgs({
  args: Bun.argv,
  options: {
    vKeyPath: {
      type: 'string',
    },
    proofPath: {
      type: 'string',
    },
  },
  strict: true,
  allowPositionals: true,
});

interface HyleOutput {
  version: number;
  initial_state: number[];
  next_state: number[];
  origin: string;
  caller: string;
  block_number: BigInt;
  block_time: BigInt;
  tx_hash: number[];
}


function parseString(vector: string[]): string {
  let length = parseInt(vector.shift() as string);
  let resp = "";
  for (var i = 0; i < length; i += 1)
    resp += String.fromCharCode(parseInt(vector.shift() as string, 16));
  return resp
}

function parseArray(vector: string[]): number[] {
  let length = parseInt(vector.shift() as string);
  let resp: number[] = [];
  for (var i = 0; i < length; i += 1)
    resp.push(parseInt(vector.shift() as string, 16));
  return resp
}


function deserializePublicInputs<T>(publicInputs: string[]): HyleOutput {
  const version = parseInt(publicInputs.shift() as string);

  const initial_state = parseArray(publicInputs);
  const next_state = parseArray(publicInputs);
  const origin = parseString(publicInputs);
  const caller = parseString(publicInputs);
  const block_number = BigInt(publicInputs.shift() as string);
  const block_time = BigInt(publicInputs.shift() as string);
  const tx_hash = parseArray(publicInputs);
  // We don't parse the rest, which correspond to programOutputs

  return {
      version,
      initial_state,
      next_state,
      origin,
      caller,
      block_number,
      block_time,
      tx_hash
  };
}

const proof = JSON.parse(fs.readFileSync(values.proofPath, { encoding: 'utf8' }));
const b64vKey = fs.readFileSync(values.vKeyPath, { encoding: 'utf8' });
const vKey = Uint8Array.from(Buffer.from(b64vKey, 'base64'));

const deserializedProofData: ProofData = {
  proof: Uint8Array.from(proof.proof),
  publicInputs: proof.publicInputs
};

// Verifying
const verifier = new Verifier();
const isValid = await verifier.verifyProof(deserializedProofData, vKey);
if (isValid){
  const hyleOutput = deserializePublicInputs(deserializedProofData.publicInputs);

  // bigint in json serialization is a pain in the ass :cry:
  // Disgusting work around -> needs refacto.
  var stringified_output = JSON.stringify(hyleOutput, (_, v) => typeof v === 'bigint' ? 'BIGINT_' + v.toString() + '_BIGINT' : v);
  stringified_output = stringified_output.replaceAll("\"BIGINT_", "");
  stringified_output = stringified_output.replaceAll("_BIGINT\"", "");

  process.stdout.write(stringified_output);
  process.exit(0);
}
else {
  process.exit(1);
}