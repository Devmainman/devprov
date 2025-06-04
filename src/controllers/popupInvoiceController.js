// controllers/popupInvoiceController.js
import PopupInvoice from '../models/PopupInvoice.js';

export const getPopupInvoices = async (req, res) => {
    try {
      const invoices = await PopupInvoice.find().sort({ createdAt: -1 });
      res.json(invoices);
    } catch (err) {
      res.status(500).json({ message: 'Server error' });
    }
  };
  
  export const createPopupInvoice = async (req, res) => {
    try {
      const invoice = new PopupInvoice(req.body); // Changed from 'Invoice' to 'PopupInvoice'
      await invoice.save(); // Changed from 'PopupInvoice.save()' to 'invoice.save()'
      res.status(201).json(invoice);
    } catch (err) {
      res.status(400).json({ message: 'Error creating invoice', error: err.message });
    }
  };
  
  export const updatePopupInvoice = async (req, res) => {
    try {
      const invoice = await PopupInvoice.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true }
      );
      if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
      res.json(invoice);
    } catch (err) {
      res.status(400).json({ message: 'Error updating invoice' });
    }
  };
  
  export const deletePopupInvoice = async (req, res) => {
    try {
      const invoice = await PopupInvoice.findByIdAndDelete(req.params.id);
      if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
      res.json({ message: 'Invoice deleted' });
    } catch (err) {
      res.status(500).json({ message: 'Server error' });
    }
  };