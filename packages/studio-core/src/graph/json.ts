import JSONBigInt from 'json-bigint';
import BigNumber from 'bignumber.js';

export const JSONBig = JSONBigInt();

export const convertBigNumberToString = (value: string) => {
  // int precision length in nebula is longer than in javascript
  return BigNumber.isBigNumber(value) ? value.toString() : value;
};
