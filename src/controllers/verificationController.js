import env from '../config/env.js';
import twilio from 'twilio';
import User from '../models/User.js';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { validateProfileData } from '../utils/validation.js';

import fs from 'fs';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure Twilio
// Replace your current Twilio initialization with:
const twilioClient = env.TWILIO_ACCOUNT_SID
  ? twilio(
      env.TWILIO_ACCOUNT_SID,
      env.TWILIO_AUTH_TOKEN
    )
  : null;

console.log('Twilio in Controller:', !!twilioClient);


// Updated saveFile function with directory creation
const saveFile = async (file, folder) => {
  const uploadDir = path.join(__dirname, `../uploads/${folder}`);
  
  // Create directory if not exists
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const fileExt = path.extname(file.name) || '.jpg';
  const fileName = `${uuidv4()}${fileExt}`;
  const uploadPath = path.join(uploadDir, fileName);

  await new Promise((resolve, reject) => {
    file.mv(uploadPath, (err) => {
      if (err) {
        console.error('File move error:', err);
        return reject(new Error('File upload failed'));
      }
      resolve();
    });
  });

  return fileName;
};

export const getVerificationStatus = async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select('verification faceImage');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      identityVerified: user.verification?.identityVerified || false,
      identityDocumentsExist: !!user.verification?.identityDocuments?.length,
      addressVerified: user.verification?.addressVerified || false,
      addressProofExist: !!user.verification?.proofOfAddress?.image,
      faceVerified: user.verification?.faceVerified || false,
      faceImage: user.verification?.faceImage || null
    });
  } catch (err) {
    console.error('Error getting verification status:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

export const completeProfile = async (req, res) => {
  try {
    console.log('Incoming request user:', req.user); // Debug log
    
    if (!req.auth?.id) {
      return res.status(401).json({
        success: false,
        message: 'Authentication data missing'
      });
    }

    const { 
      firstName, 
      lastName, 
      phoneNumber, 
      country, 
      gender, 
      currency 
    } = req.body;

    // Add validation
    const validation = validateProfileData(req.body);
    if (!validation.valid) {
      return res.status(400).json({ 
        success: false,
        message: 'Validation failed',
        errors: validation.errors 
      });
    }

    const user = await User.findById(req.auth.id); // Changed from req.user.id to req.auth.id
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }

    // Update user fields
    user.firstName = firstName;
    user.lastName = lastName;
    user.mobile = phoneNumber;
    user.country = country;
    user.gender = gender;
    user.currency = currency;

    const savedUser = await user.save();
    console.log('Profile updated successfully:', savedUser);

    res.json({ 
      success: true,
      message: 'Profile updated successfully',
      user: {
        firstName: savedUser.firstName,
        lastName: savedUser.lastName,
        email: savedUser.email,
        phoneNumber: savedUser.phoneNumber
      }
    });
  } catch (err) {
    console.error('Error in completeProfile:', {
      error: err,
      stack: err.stack,
      requestBody: req.body,
      authData: req.auth
    });
    res.status(500).json({ 
      success: false,
      message: err.message || 'Server error' 
    });
  }
};

  // export const verifyPhone = async (req, res) => {
  //   console.log('Twilio Config:', {
  //     hasSid: !!process.env.TWILIO_ACCOUNT_SID,
  //     hasAuthToken: !!process.env.TWILIO_AUTH_TOKEN,
  //     hasPhoneNumber: !!process.env.TWILIO_PHONE_NUMBER
  //   });
  //   try {
  //     console.log('Initiating phone verification...');
      
  //     const user = await User.findById(req.user.id);
  //     if (!user) {
  //       console.log('User not found for ID:', req.user.id);
  //       return res.status(404).json({ message: 'User not found' });
  //     }
  
  //     // Validate phone number
  //     if (!user.phoneNumber) {
  //       console.log('No phone number found for user');
  //       return res.status(400).json({ message: 'Phone number not registered' });
  //     }
  
  //     console.log('Phone number to verify:', user.phoneNumber);
  
  //     // Generate OTP
  //     const otp = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit random number
  //     const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry
  
  //     // Save OTP to user
  //     user.otp = { code: otp, expiresAt };
  //     await user.save();
  //     console.log('OTP generated and saved:', otp);
  
  //     // Send OTP via Twilio if in production with valid credentials
  //     if (process.env.NODE_ENV === 'production' || process.env.FORCE_SMS === 'true') {
  //       try {
  //         if (!twilioClient) throw new Error('Twilio client not initialized');
          
  //         console.log('Attempting to send SMS to:', user.phoneNumber);
  //         const message = await twilioClient.messages.create({
  //           body: `Your ${process.env.APP_NAME || 'App'} code: ${otp}`,
  //           from: process.env.TWILIO_PHONE_NUMBER,
  //           to: user.phoneNumber
  //         });
          
  //         console.log('Twilio Message SID:', message.sid);
  //       } catch (twilioError) {
  //         console.error('Twilio Error Details:', {
  //           code: twilioError.code,
  //           message: twilioError.message,
  //           moreInfo: twilioError.moreInfo
  //         });
          
  //         // Still allow verification via debug OTP
  //         return res.status(500).json({
  //           success: false,
  //           message: 'SMS sending failed',
  //           debugOtp: otp,
  //           twilioError: process.env.NODE_ENV === 'development' ? twilioError.message : null
  //         });
  //       }
  //     }
  
  //     // Response
  //     res.json({
  //       success: true,
  //       message: process.env.NODE_ENV === 'production' 
  //         ? 'OTP sent via SMS' 
  //         : 'OTP generated (development mode)',
  //       debugOtp: otp,  // Always return OTP in development for testing
  //       phoneNumber: user.phoneNumber,
  //       expiresAt: expiresAt.toISOString()
  //     });
  
  //   } catch (err) {
  //     console.error('OTP Error:', {
  //       error: err,
  //       stack: err.stack,
  //       twilioError: err.code,
  //       message: err.message
  //     });
      
  //     res.status(500).json({
  //       success: false,
  //       error: 'OTP service failed',
  //       debugInfo: process.env.NODE_ENV === 'development' ? {
  //         message: err.message,
  //         stack: err.stack
  //       } : null
  //     });
  //   }
  // };

export const verifyOtp = async (req, res) => {
  try {
    const { otp } = req.body;
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!user.otp || user.otp.code !== otp) {
      return res.status(400).json({ message: 'Invalid OTP' });
    }

    if (new Date() > user.otp.expiresAt) {
      return res.status(400).json({ message: 'OTP has expired' });
    }

    user.verification.phoneVerified = true;
    user.otp = undefined;
    await user.save();

    res.json({ 
      success: true,
      message: 'Phone number verified successfully'
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// Update uploadIdDocument to use async/await
export const uploadIdDocument = async (req, res) => {
  try {
    console.log('Authenticated user:', req.user); // Debug log
    
    if (!req.user?.id) {
      return res.status(401).json({ 
        success: false,
        message: 'User authentication missing' 
      });
    }

    if (!req.files?.frontImage || !req.body.documentType) {
      return res.status(400).json({ 
        success: false,
        message: 'Front image and document type are required' 
      });
    }

    // Validate document type
    const validTypes = ['passport', 'national_id', 'driver_license'];
    if (!validTypes.includes(req.body.documentType)) {
      return res.status(400).json({ 
        success: false,
        message: `Invalid document type. Must be one of: ${validTypes.join(', ')}`
      });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }

    // Process files
    const frontImageName = await saveFile(req.files.frontImage, 'id_documents');
    const backImageName = req.files.backImage 
      ? await saveFile(req.files.backImage, 'id_documents') 
      : null;

    // Create document object
    const document = {
      type: req.body.documentType,
      frontImage: frontImageName,
      backImage: backImageName,
      verified: false,
      uploadedAt: new Date()
    };

    // Update user's documents
    user.verification.identityDocuments = user.verification.identityDocuments || [];
    user.verification.identityDocuments.push(document);
    await user.save();

    res.status(200).json({ 
      success: true,
      message: 'ID document uploaded successfully',
      data: {
        document
      }
    });

  } catch (err) {
    console.error('ID Document Upload Error:', {
      error: err,
      stack: err.stack,
      userId: req.user?.id,
      files: req.files && {
        frontImage: req.files.frontImage?.name,
        backImage: req.files.backImage?.name
      },
      body: req.body
    });
    
    res.status(500).json({ 
      success: false,
      message: err.message || 'Document upload failed'
    });
  }
};

// verificationController.js
export const uploadAddressProof = async (req, res) => {
  try {
    if (!req.files?.document || !req.body.documentType) {
      return res.status(400).json({ 
        success: false,
        message: 'Document and document type are required' 
      });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // 1. AWAIT the file save operation
    const fileName = await saveFile(req.files.document, 'address_proofs');
    console.log('Saved file:', fileName); // Verify the filename

    // 2. Only proceed after file is saved
    user.verification.proofOfAddress = {
      documentType: req.body.documentType,
      image: fileName, // This should now be a string
      verified: false
    };

    // 3. AWAIT the user save
    await user.save();

    res.json({ 
      success: true,
      message: 'Address proof uploaded successfully',
      data: {
        documentUrl: `/uploads/address_proofs/${fileName}`
      }
    });
  } catch (err) {
    console.error('Upload error:', err);
    
    // Clean up if file was saved but user update failed
    if (fileName && fs.existsSync(`uploads/address_proofs/${fileName}`)) {
      fs.unlinkSync(`uploads/address_proofs/${fileName}`);
    }

    res.status(500).json({ 
      success: false,
      message: err.message || 'Document upload failed'
    });
  }
};

export const uploadFaceImage = async (req, res) => {
  try {
    if (!req.files || !req.files.image) {
      return res.status(400).json({ 
        success: false,
        message: 'Image is required' 
      });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }

    // Save file and await the result
    const imageName = await saveFile(req.files.image, 'face_images');
    
    // Set the faceImage field with the resolved string
    user.verification.faceImage = imageName;
    user.verification.faceVerified = false;

    await user.save();

    res.json({ 
      success: true,
      message: 'Face image uploaded successfully',
      data: {
        faceImage: imageName  // Return the filename string
      }
    });

  } catch (err) {
    console.error('Error uploading face image:', err);
    res.status(500).json({ 
      success: false,
      message: err.message || 'Server error' 
    });
  }
};


export const saveAddress = async (req, res) => {
  try {
    const { street, city, state, postalCode, country } = req.body;

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Save address information
    user.address = {
      street,
      city,
      state,
      postalCode,
      country
    };

    await user.save();

    res.json({ 
      success: true,
      message: 'Address saved successfully',
      address: user.address
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: err.message || 'Server error' });
  }
};

export const getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select('-password -otp -__v');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const responseData = {
      firstName: user.firstName,
      lastName: user.lastName,
      accountId: user.accountId,
      faceImage: user.verification.faceImage,
      verification: user.verification,
      phoneNumber: user.mobile,
      email: user.email,
      country: user.country,
      gender: user.gender,
      currency: user.currency,
    };

    console.log('Generated face image URL:', 
      `${process.env.API_BASE_URL || 'http://localhost:5000'}/uploads/face_images/${user.verification.faceImage}`
    );

    res.json(responseData);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

