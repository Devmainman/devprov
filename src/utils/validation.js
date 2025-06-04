export const validateEmail = (email) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(String(email).toLowerCase());
  };
  
  export const validatePassword = (password) => {
    return password.length >= 6;
  };
  
  export const validatePhoneNumber = (phone) => {
    // Basic international phone number validation
    const re = /^\+?[1-9]\d{1,14}$/; // E.164 format
    return re.test(phone);
  };
  
  export const validateUserInput = (email, password) => {
    if (!validateEmail(email)) {
      return { valid: false, message: 'Invalid email format' };
    }
    
    if (!validatePassword(password)) {
      return { valid: false, message: 'Password must be at least 6 characters' };
    }
    
    return { valid: true };
  };
  
  export const validateAdminInput = (email, password) => {
    if (!validateEmail(email)) {
      return { valid: false, message: 'Invalid email format' };
    }
    
    if (!validatePassword(password)) {
      return { valid: false, message: 'Password must be at least 6 characters' };
    }
    
    return { valid: true };
  };
  
  // New validation functions for verification flow
  export const validateProfileData = (data) => {
    const { firstName, lastName, phoneNumber, country, gender, currency } = data;
    const errors = {};
  
    if (!firstName || firstName.trim().length < 2) {
      errors.firstName = 'First name must be at least 2 characters';
    }
  
    if (!lastName || lastName.trim().length < 2) {
      errors.lastName = 'Last name must be at least 2 characters';
    }
  
    if (!validatePhoneNumber(phoneNumber)) {
      errors.phoneNumber = 'Invalid phone number format';
    }
  
    if (!country) {
      errors.country = 'Country is required';
    }
  
    if (!gender) {
      errors.gender = 'Gender is required';
    }
  
    if (!currency) {
      errors.currency = 'Currency is required';
    }
  
    return {
      valid: Object.keys(errors).length === 0,
      errors
    };
  };
  
  export const validateAddressData = (data) => {
    const { street, city, state, postalCode, country } = data;
    const errors = {};
  
    if (!street || street.trim().length < 3) {
      errors.street = 'Street address is required';
    }
  
    if (!city || city.trim().length < 2) {
      errors.city = 'City is required';
    }
  
    if (!state || state.trim().length < 2) {
      errors.state = 'State is required';
    }
  
    if (!postalCode || postalCode.trim().length < 3) {
      errors.postalCode = 'Postal code is required';
    }
  
    if (!country) {
      errors.country = 'Country is required';
    }
  
    return {
      valid: Object.keys(errors).length === 0,
      errors
    };
  };
  
  export const validateOTP = (otp) => {
    const re = /^\d{6}$/;
    return re.test(otp);
  };