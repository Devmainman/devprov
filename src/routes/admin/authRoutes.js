// In routes/admin/authRoutes.js
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    
    const admin = await Admin.findOne({ email });
    if (!admin) {
      return res.status(401).json({ message: 'Invalid admin credentials' });
    }
  
    const isMatch = await admin.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid admin credentials' });
    }
  
    const token = jwt.sign(
      { id: admin._id, isAdmin: true }, // Crucial flag
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );
  
    res.json({ token, role: 'admin' });
  });