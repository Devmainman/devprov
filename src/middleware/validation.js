export const validateWithdrawalMethod = (req, res, next) => {
    const { title, details } = req.body;
    
    if (!title || !title.trim()) {
      return res.status(400).json({ message: 'Title is required' });
    }
    
    if (!details || !Array.isArray(details) || details.length === 0) {
      return res.status(400).json({ message: 'At least one detail is required' });
    }
    
    for (const detail of details) {
      if (!detail.label || !detail.value) {
        return res.status(400).json({ message: 'All details must have both label and value' });
      }
    }
    
    next();
  };