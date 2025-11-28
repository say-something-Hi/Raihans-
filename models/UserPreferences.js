const mongoose = require('mongoose');

const userPreferenceSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  preferences: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: {}
  },
  conversationStyle: {
    type: String,
    enum: ['friendly', 'professional', 'casual', 'humorous'],
    default: 'friendly'
  },
  learnedFactsCount: {
    type: Number,
    default: 0
  },
  favoriteTopics: [String],
  bannedTopics: [String],
  customResponses: {
    type: Map,
    of: String,
    default: {}
  },
  lastActive: {
    type: Date,
    default: Date.now
  },
  totalMessages: {
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

userPreferenceSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Update last active timestamp
userPreferenceSchema.statics.updateLastActive = function(userId) {
  return this.findOneAndUpdate(
    { userId },
    { 
      $set: { lastActive: new Date() },
      $inc: { totalMessages: 1 }
    },
    { upsert: true, new: true }
  );
};

// Add or update preference
userPreferenceSchema.statics.updatePreference = function(userId, key, value) {
  return this.findOneAndUpdate(
    { userId },
    { 
      $set: { [`preferences.${key}`]: value },
      $set: { lastActive: new Date() }
    },
    { upsert: true, new: true }
  );
};

// Add favorite topic
userPreferenceSchema.statics.addFavoriteTopic = function(userId, topic) {
  return this.findOneAndUpdate(
    { userId },
    { 
      $addToSet: { favoriteTopics: topic.toLowerCase() },
      $set: { lastActive: new Date() }
    },
    { upsert: true, new: true }
  );
};

module.exports = mongoose.model('UserPreferences', userPreferenceSchema);
