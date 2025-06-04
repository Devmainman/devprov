// controllers/popupMessageController.js
import PopupMessage from '../models/PopupMessage.js';
import path from 'path';
import fs from 'fs';

export const getPopupMessages = async (req, res) => {
    try {
      const popups = await PopupMessage.find().sort({ createdAt: -1 });
      res.json(popups);
    } catch (err) {
      res.status(500).json({ message: 'Server error' });
    }
  };
  
  export const createPopupMessage = async (req, res) => {
    try {
      const { title, description, status } = req.body;
      let filePath = '';
  
      if (req.files && req.files.file) {
        const file = req.files.file;
        const uploadDir = path.join(process.cwd(), 'uploads', 'popups');
        
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }
        
        const fileName = `${Date.now()}-${file.name}`;
        filePath = path.join(uploadDir, fileName);
        await file.mv(filePath);
        filePath = `/uploads/popups/${fileName}`;
      }
  
      const popup = new PopupMessage({ // Changed from 'Popup' to 'PopupMessage'
        title,
        description,
        status,
        file: req.files?.file?.name || '',
        filePath
      });
  
      await popup.save(); // Changed from 'PopupMessage.save()' to 'popup.save()'
      res.status(201).json(popup);
    } catch (err) {
      res.status(400).json({ message: 'Error creating popup', error: err.message });
    }
  };
  
  // Fix update function references
  export const updatePopupMessage = async (req, res) => {
    try {
      const { title, description, status } = req.body;
      const popup = await PopupMessage.findById(req.params.id);
      
      if (!popup) {
        return res.status(404).json({ message: 'Popup not found' });
      }
  
      let filePath = popup.filePath; // Changed from 'PopupMessage.filePath'
  
      if (req.files && req.files.file) {
        // Delete old file if exists
        if (popup.filePath) {
          const oldFilePath = path.join(process.cwd(), popup.filePath); // Changed from 'PopupMessage.filePath'
          if (fs.existsSync(oldFilePath)) {
            fs.unlinkSync(oldFilePath);
          }
        }
  
        // Upload new file
        const file = req.files.file;
        const uploadDir = path.join(process.cwd(), 'uploads', 'popups');
        
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }
        
        const fileName = `${Date.now()}-${file.name}`;
        filePath = path.join(uploadDir, fileName);
        await file.mv(filePath);
        filePath = `/uploads/popups/${fileName}`;
      }
  
      const updatedPopup = await PopupMessage.findByIdAndUpdate(
        req.params.id,
        {
          title,
          description,
          status,
          file: req.files?.file?.name || popup.file, // Changed from 'PopupMessage.file'
          filePath: req.files?.file ? filePath : popup.filePath // Changed from 'PopupMessage.filePath'
        },
        { new: true }
      );
  
      res.json(updatedPopup);
    } catch (err) {
      res.status(400).json({ message: 'Error updating popup', error: err.message });
    }
  };
  
  // Fix delete function references
  export const deletePopupMessage = async (req, res) => {
    try {
      const popup = await PopupMessage.findByIdAndDelete(req.params.id);
      
      if (!popup) {
        return res.status(404).json({ message: 'Popup not found' });
      }
  
      // Delete associated file
      if (popup.filePath) {
        const filePath = path.join(process.cwd(), popup.filePath); // Changed from 'PopupMessage.filePath'
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
  
      res.json({ message: 'Popup deleted' });
    } catch (err) {
      res.status(500).json({ message: 'Server error', error: err.message });
    }
  };