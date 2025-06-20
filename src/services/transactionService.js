import { v4 as uuidv4 } from 'uuid';
import Transaction from '../models/Transaction.js'; // Adjust path as needed

export const createTransaction = async (transactionData) => {
  const transaction = new Transaction({
    ...transactionData,
    reference: uuidv4() // Generates unique reference
  });

  await transaction.save();
  return transaction;
};