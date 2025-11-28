const mongoose = require('mongoose');

const knowledgeSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true
  },
  topic: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },
  fact: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    default: 'general',
    lowercase: true
  },
  confidence: {
    type: Number,
    default: 1,
    min: 0,
    max: 10
  },
  source: {
    type: String,
    default: 'user'
  },
  examples: [String],
  tags: [String],
  lastUsed: {
    type: Date,
    default: Date.now
  },
  usageCount: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Compound index for unique topics per user
knowledgeSchema.index({ userId: 1, topic: 1 }, { unique: true });

// Update the updatedAt field before saving
knowledgeSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Static method to find knowledge by user and topic
knowledgeSchema.statics.findByUserAndTopic = function(userId, topic) {
  return this.findOne({ userId, topic: topic.toLowerCase() });
};

// Static method to get all knowledge for a user
knowledgeSchema.statics.findByUser = function(userId, limit = 50) {
  return this.find({ userId })
    .sort({ lastUsed: -1, confidence: -1 })
    .limit(limit);
};

// Static method to increment usage count
knowledgeSchema.statics.incrementUsage = function(userId, topic) {
  return this.findOneAndUpdate(
    { userId, topic: topic.toLowerCase() },
    { 
      $inc: { usageCount: 1 },
      $set: { lastUsed: new Date() }
    },
    { new: true }
  );
};

// Static method to search knowledge
knowledgeSchema.statics.searchKnowledge = function(userId, query) {
  return this.find({
    userId,
    $or: [
      { topic: { $regex: query, $options: 'i' } },
      { fact: { $regex: query, $options: 'i' } },
      { tags: { $in: [new RegExp(query, 'i')] } }
    ]
  }).sort({ confidence: -1, usageCount: -1 });
};

module.exports = mongoose.model('Knowledge', knowledgeSchema);
