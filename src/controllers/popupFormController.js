// controllers/popupFormController.js
import PopupForm from '../models/PopupForm.js';

export const getPopupForms = async (req, res) => {
    try {
      const forms = await PopupForm.find().sort({ createdAt: -1 });
      res.json(forms);
    } catch (err) {
      res.status(500).json({ message: 'Server error' });
    }
  };
  
  export const createPopupForm = async (req, res) => {
    try {
      const form = new PopupForm(req.body); // Changed from 'Form' to 'PopupForm'
      await form.save(); // Changed from 'PopupForm.save()' to 'form.save()'
      res.status(201).json(form);
    } catch (err) {
      res.status(400).json({ message: 'Error creating form', error: err.message });
    }
  };
  
  export const updatePopupForm = async (req, res) => {
    try {
      const form = await PopupForm.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true }
      );
      if (!form) return res.status(404).json({ message: 'Form not found' });
      res.json(form);
    } catch (err) {
      res.status(400).json({ message: 'Error updating form' });
    }
  };
  
  export const deletePopupForm = async (req, res) => {
    try {
      const form = await PopupForm.findByIdAndDelete(req.params.id);
      if (!form) return res.status(404).json({ message: 'Form not found' });
      res.json({ message: 'Form deleted' });
    } catch (err) {
      res.status(500).json({ message: 'Server error' });
    }
  };