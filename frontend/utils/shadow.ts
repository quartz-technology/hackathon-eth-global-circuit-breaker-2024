import { ethers, BigNumberish } from "ethers";

export function generateSubmitTransactionSignal(to: string, value: BigNumberish, data: string) {
    return ethers.utils.keccak256(ethers.utils.solidityPack(["address", "uint256", "bytes"], [to, value, data]));
}

export function generateSubmitTransactionExternalNullifier(numTxs: number, signal: BigNumberish) {
    return ethers.utils.keccak256(ethers.utils.solidityPack(["uint", "uint256"], [numTxs, signal]));
}

export function generateConfirmTransactionSignal() {
    return ethers.utils.keccak256(ethers.utils.solidityPack(["bool"], [true]));
}

export function generateConfirmTransactionExternalNullifier(txIndex: number, signal: BigNumberish) {
    return ethers.utils.keccak256(ethers.utils.solidityPack(["uint", "uint256"], [txIndex, signal]));
}

export function generateRevokeTransactionSignal() {
    return ethers.utils.keccak256(ethers.utils.solidityPack(["bool"], [false]));
}

export function generateRevokeTransactionExternalNullifier(txIndex: number, signal: BigNumberish) {
    return ethers.utils.keccak256(ethers.utils.solidityPack(["uint", "uint256"], [txIndex, signal]));
}