import Invoice from '../models/Invoice.js';
import { sendNotification } from '../app.js';

// Helper function for pagination
const paginateResults = (results, page, limit) => {
  const startIndex = (page - 1) * limit;
  const endIndex = page * limit;
  
  return {
    results: results.slice(startIndex, endIndex),
    currentPage: page,
    totalPages: Math.ceil(results.length / limit),
    totalItems: results.length
  };
};

// Get all invoices with pagination and search
export const getInvoices = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '' } = req.query;
    const searchRegex = new RegExp(search, 'i');

    // Find invoices matching search term
    const invoices = await Invoice.find({
      $or: [
        { accountId: searchRegex },
        { fullName: searchRegex },
        { entity: searchRegex }
      ]
    }).sort({ date: -1 });

    // Paginate results
    const paginated = paginateResults(invoices, parseInt(page), parseInt(limit));
    
    res.json(paginated);
  } catch (error) {
    console.error('Error fetching invoices:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Update invoice status
export const updateInvoiceStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, disputeReason } = req.body;
    
    // Validate status
    const validStatuses = ['pending', 'approved', 'rejected', 'disputed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }
    
    // Validate dispute reason when disputing
    if (status === 'disputed' && (!disputeReason || disputeReason.trim() === '')) {
      return res.status(400).json({ message: 'Dispute reason is required' });
    }
    
    // Find and update invoice
    const invoice = await Invoice.findById(id);
    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }
    
    invoice.status = status;
    if (status === 'disputed') {
      invoice.disputeReason = disputeReason;
    } else if (status === 'approved' || status === 'rejected') {
      invoice.disputeReason = '';
    }
    
    const updatedInvoice = await invoice.save();
    
    // Send notification if status changed to disputed
    if (status === 'disputed' && invoice.userId) {
      sendNotification(invoice.userId, {
        title: 'Invoice Disputed',
        message: `Your invoice #${invoice.id} has been disputed. Reason: ${disputeReason}`,
        type: 'warning'
      });
    }
    
    res.json(updatedInvoice);
  } catch (error) {
    console.error('Error updating invoice status:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Delete an invoice
export const deleteInvoice = async (req, res) => {
  try {
    const { id } = req.params;
    const invoice = await Invoice.findByIdAndDelete(id);
    
    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }
    
    res.json({ message: 'Invoice deleted successfully' });
  } catch (error) {
    console.error('Error deleting invoice:', error);
    res.status(500).json({ message: 'Server error' });
  }
};