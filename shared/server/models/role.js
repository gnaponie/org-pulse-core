const mongoose = require('mongoose')

const roleAssignmentSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, index: true },
  roles: { type: [String], default: [] },
  assignedBy: { type: String },
  assignedAt: { type: String }
}, {
  timestamps: true,
  collection: 'core__roles'
})

module.exports = { roleAssignmentSchema }
