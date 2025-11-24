const mongoose = require('mongoose');

const folderSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Folder name is required'],
    trim: true,
    maxlength: [100, 'Folder name cannot exceed 100 characters']
  },
  parent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Folder',
    default: null
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  visibility: {
    type: String,
    enum: ['owner', 'invited', 'public'],
    default: 'owner'
  },
  allowedUsers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  inviteCode: {
    type: String,
    unique: true,
    sparse: true // Only unique if present
  },
  inviteLink: {
    type: String,
    unique: true,
    sparse: true
  },
  inviteLinkExpiry: {
    type: Date
  }
}, {
  timestamps: true
});

// Index for faster lookups
folderSchema.index({ createdBy: 1, parent: 1 });

module.exports = mongoose.model('Folder', folderSchema);
