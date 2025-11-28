const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const { MongoClient, ServerApiVersion } = require('mongodb');

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// MongoDB Connection
class MongoDBManager {
  constructor() {
    this.client = null;
    this.db = null;
    this.isConnected = false;
  }

  async connect() {
    try {
      const username = 'mayberaihon00_db_user';
      const password = 'CGOmIFrYém9ATESO';
      const encodedPassword = encodeURIComponent(password);
      const connectionString = `mongodb+srv://${username}:${encodedPassword}@cluster0.ns0lcvd.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

      this.client = new MongoClient(connectionString, {
        serverApi: {
          version: ServerApiVersion.v1,
          strict: true,
          deprecationErrors: true,
        }
      });

      await this.client.connect();
      this.db = this.client.db('chatbot_db');
      this.isConnected = true;
      
      console.log('✅ Connected to MongoDB Atlas');
      
      // Create indexes
      await this.createIndexes();
      
      return this.db;
    } catch (error) {
      console.error('❌ MongoDB connection error:', error);
      this.isConnected = false;
      // Don't throw error - allow app to run without DB
      return null;
    }
  }

  async createIndexes() {
    try {
      await this.db.collection('knowledge').createIndex({ userId: 1, topic: 1 }, { unique: true });
      await this.db.collection('user_preferences').createIndex({ userId: 1 }, { unique: true });
      console.log('✅ Database indexes created');
    } catch (error) {
      console.error('Error creating indexes:', error);
    }
  }

  async disconnect() {
    if (this.client) {
      await this.client.close();
      this.isConnected = false;
      console.log('✅ Disconnected from MongoDB');
    }
  }
}

// Initialize MongoDB
const mongoDB = new MongoDBManager();

// Enhanced HumanChatbot class with MongoDB
class HumanChatbot {
  constructor() {
    this.conversationHistory = new Map();
    this.personalityTraits = {
      friendly: true,
      curious: true,
      empathetic: true,
      humorous: true,
      teachable: true
    };
    
    this.initializeDatabase();
  }

  async initializeDatabase() {
    try {
      await mongoDB.connect();
      console.log('🤖 Chatbot initialized with MongoDB storage');
    } catch (error) {
      console.error('Failed to initialize database:', error);
    }
  }

  // Response patterns
  responsePatterns = {
    greeting: [
      "Hey there! 👋 How's your day going?",
      "Hello! Nice to meet you! What's on your mind?",
      "Hi! I'm here to chat. What would you like to talk about?",
      "Hey! Great to see you. How can I help you today?"
    ],
    question: [
      "That's an interesting question. Let me think...",
      "Hmm, good question! From what I understand...",
      "I've been wondering about that too. Here's what I think...",
      "That's a thoughtful question. In my opinion..."
    ],
    feeling: [
      "I understand how you feel. That sounds {sentiment}.",
      "I can imagine that must be {sentiment}. Want to talk more about it?",
      "Thanks for sharing that. It sounds {sentiment}.",
      "I appreciate you telling me that. It seems {sentiment}."
    ],
    casual: [
      "You know, that reminds me of something interesting...",
      "I was just thinking about that too!",
      "That's really cool! Tell me more.",
      "I love chatting about things like this!"
    ],
    farewell: [
      "It was great talking with you! Come back anytime 👋",
      "Thanks for the chat! I enjoyed our conversation.",
      "Take care! Hope to talk with you again soon!",
      "Goodbye! Don't be a stranger 😊"
    ],
    learning: [
      "Thanks for teaching me that! I'll remember it for next time. 📚",
      "That's new information for me! I've added it to my knowledge. 🧠",
      "I didn't know that! Now I've learned something new. Thanks! 🌟",
      "Interesting! I'll store that in my memory for future conversations. 💾"
    ],
    recall: [
      "I remember you taught me that {fact}. Is that right?",
      "Based on what you told me earlier, {fact}",
      "You mentioned before that {fact}. Did I remember correctly?",
      "I recall learning from you that {fact}"
    ],
    knowledgeIntegration: [
      "That reminds me - you taught me that {topic} is {fact}.",
      "Speaking of {topic}, I remember learning that {fact}.",
      "By the way, about {topic} - you mentioned that {fact}.",
      "I recall our conversation about {topic}. You said {fact}."
    ]
  };

  // Store knowledge in MongoDB
  async storeKnowledge(userId, knowledgeData) {
    if (!mongoDB.isConnected) {
      console.log('MongoDB not connected, skipping knowledge storage');
      return { success: false, error: 'Database not connected' };
    }

    try {
      const { topic, fact, category = 'general', examples = [], tags = [] } = knowledgeData;
      
      const knowledgeCollection = mongoDB.db.collection('knowledge');
      
      const knowledgeDoc = {
        userId,
        topic: topic.toLowerCase().trim(),
        fact: fact.trim(),
        category,
        examples,
        tags: [...tags, category],
        confidence: 1,
        source: 'user',
        usageCount: 0,
        lastUsed: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      try {
        await knowledgeCollection.insertOne(knowledgeDoc);
        
        // Update user preferences to track learning
        await this.updateUserLearnedCount(userId);
        
        return { success: true, knowledge: knowledgeDoc };
      } catch (error) {
        if (error.code === 11000) {
          // Duplicate key - update existing knowledge
          const updated = await knowledgeCollection.findOneAndUpdate(
            { userId, topic: topic.toLowerCase() },
            { 
              $set: { 
                fact: fact.trim(),
                category,
                examples,
                tags: [...tags, category],
                updatedAt: new Date()
              },
              $inc: { confidence: 0.5 }
            },
            { returnDocument: 'after' }
          );
          return { success: true, knowledge: updated.value, updated: true };
        }
        throw error;
      }
    } catch (error) {
      console.error('Error storing knowledge:', error);
      throw error;
    }
  }

  // Update user learned count
  async updateUserLearnedCount(userId) {
    if (!mongoDB.isConnected) return;

    try {
      const userPrefsCollection = mongoDB.db.collection('user_preferences');
      
      await userPrefsCollection.updateOne(
        { userId },
        { 
          $inc: { learnedFactsCount: 1 },
          $set: { lastActive: new Date(), updatedAt: new Date() },
          $setOnInsert: { createdAt: new Date(), preferences: {} }
        },
        { upsert: true }
      );
    } catch (error) {
      console.error('Error updating user learned count:', error);
    }
  }

  // Get knowledge from MongoDB
  async getKnowledge(userId, topic = null) {
    if (!mongoDB.isConnected) {
      return topic ? null : {};
    }

    try {
      const knowledgeCollection = mongoDB.db.collection('knowledge');
      
      if (topic) {
        const knowledge = await knowledgeCollection.findOne({ 
          userId, 
          topic: topic.toLowerCase() 
        });
        
        if (knowledge) {
          // Increment usage count
          await knowledgeCollection.updateOne(
            { _id: knowledge._id },
            { 
              $inc: { usageCount: 1 },
              $set: { lastUsed: new Date() }
            }
          );
          return knowledge.fact;
        }
        return null;
      } else {
        const knowledgeList = await knowledgeCollection.find({ userId })
          .sort({ lastUsed: -1, confidence: -1 })
          .limit(50)
          .toArray();
          
        const knowledgeMap = {};
        knowledgeList.forEach(item => {
          knowledgeMap[item.topic] = item.fact;
        });
        return knowledgeMap;
      }
    } catch (error) {
      console.error('Error fetching knowledge:', error);
      return topic ? null : {};
    }
  }

  // Search knowledge in MongoDB
  async searchKnowledge(userId, query) {
    if (!mongoDB.isConnected) return [];

    try {
      const knowledgeCollection = mongoDB.db.collection('knowledge');
      
      const results = await knowledgeCollection.find({
        userId,
        $or: [
          { topic: { $regex: query, $options: 'i' } },
          { fact: { $regex: query, $options: 'i' } },
          { tags: { $in: [new RegExp(query, 'i')] } }
        ]
      })
      .sort({ confidence: -1, usageCount: -1 })
      .limit(20)
      .toArray();

      return results.map(item => ({
        topic: item.topic,
        fact: item.fact,
        confidence: item.confidence,
        usageCount: item.usageCount
      }));
    } catch (error) {
      console.error('Error searching knowledge:', error);
      return [];
    }
  }

  // Extract and store knowledge from user message
  async extractAndStoreKnowledge(message, userId) {
    const knowledge = this.extractKnowledge(message, userId);
    
    if (Object.keys(knowledge).length > 0) {
      const storedKnowledge = [];
      
      for (const [topic, fact] of Object.entries(knowledge)) {
        try {
          const result = await this.storeKnowledge(userId, {
            topic,
            fact,
            category: this.categorizeTopic(topic),
            tags: this.generateTags(topic, fact)
          });
          if (result.success) {
            storedKnowledge.push({ topic, fact, ...result });
          }
        } catch (error) {
          console.error(`Error storing knowledge for ${topic}:`, error);
        }
      }
      
      return storedKnowledge;
    }
    
    return [];
  }

  // Enhanced knowledge extraction
  extractKnowledge(message, userId) {
    const knowledge = {};
    const lowerMsg = message.toLowerCase();
    
    // Pattern 1: "X is Y" statements
    const isPattern = message.match(/(\w[\w\s]+) is (a |an |the )?([^\.!?]+)[\.!?]?/i);
    if (isPattern) {
      const topic = isPattern[1].trim();
      const definition = isPattern[3].trim();
      knowledge[topic] = definition;
    }
    
    // Pattern 2: "My favorite X is Y"
    const favoritePattern = message.match(/my favorite ([\w\s]+) is ([\w\s]+)/i);
    if (favoritePattern) {
      const category = `favorite_${favoritePattern[1].trim()}`;
      const item = favoritePattern[2].trim();
      knowledge[category] = item;
      this.storeUserPreference(userId, favoritePattern[1].trim(), item);
    }
    
    // Pattern 3: "X means Y"
    const meansPattern = message.match(/(\w[\w\s]*) means ([\w\s]+)/i);
    if (meansPattern) {
      const word = meansPattern[1].trim();
      const meaning = meansPattern[2].trim();
      knowledge[word] = meaning;
    }
    
    // Pattern 4: Direct teaching statements
    if (lowerMsg.includes('teach you') || lowerMsg.includes('you should know')) {
      const parts = message.split(/that|:/);
      if (parts.length > 1) {
        const fact = parts[1].trim();
        const topicMatch = fact.match(/(\w+) is/);
        if (topicMatch) {
          knowledge[topicMatch[1].toLowerCase()] = fact;
        }
      }
    }
    
    // Pattern 5: "I like X" or "I love X"
    const likePattern = message.match(/I (like|love) ([\w\s]+)/i);
    if (likePattern) {
      const item = likePattern[2].trim();
      knowledge[`likes_${item}`] = `User likes ${item}`;
    }

    // Pattern 6: "X are Y" for plural
    const arePattern = message.match(/(\w[\w\s]+) are ([\w\s]+)/i);
    if (arePattern) {
      const topic = arePattern[1].trim();
      const definition = arePattern[2].trim();
      knowledge[topic] = definition;
    }
    
    return knowledge;
  }

  categorizeTopic(topic) {
    const categories = {
      programming: ['javascript', 'python', 'java', 'programming', 'code', 'algorithm', 'html', 'css', 'react'],
      science: ['science', 'physics', 'chemistry', 'biology', 'space', 'universe', 'math', 'mathematics'],
      geography: ['country', 'city', 'capital', 'location', 'map', 'continent', 'ocean'],
      food: ['food', 'cuisine', 'recipe', 'cooking', 'restaurant', 'fruit', 'vegetable'],
      entertainment: ['movie', 'music', 'game', 'book', 'artist', 'song', 'film', 'actor'],
      personal: ['favorite', 'like', 'love', 'hate', 'prefer', 'my', 'i am']
    };
    
    const lowerTopic = topic.toLowerCase();
    for (const [category, keywords] of Object.entries(categories)) {
      if (keywords.some(keyword => lowerTopic.includes(keyword))) {
        return category;
      }
    }
    
    return 'general';
  }

  generateTags(topic, fact) {
    const tags = [topic.toLowerCase()];
    const words = `${topic} ${fact}`.toLowerCase().split(/\s+/);
    
    const commonTags = ['learned', 'user-taught', 'knowledge'];
    return [...new Set([...tags, ...words.filter(word => word.length > 3), ...commonTags])];
  }

  async storeUserPreference(userId, category, value) {
    if (!mongoDB.isConnected) return;

    try {
      const userPrefsCollection = mongoDB.db.collection('user_preferences');
      
      await userPrefsCollection.updateOne(
        { userId },
        { 
          $set: { 
            [`preferences.${category}`]: value,
            lastActive: new Date(),
            updatedAt: new Date()
          },
          $setOnInsert: { 
            createdAt: new Date(),
            conversationStyle: 'friendly',
            learnedFactsCount: 0,
            totalMessages: 0
          }
        },
        { upsert: true }
      );

      if (['color', 'food', 'movie', 'music', 'book', 'sport', 'hobby'].includes(category.toLowerCase())) {
        await userPrefsCollection.updateOne(
          { userId },
          { 
            $addToSet: { favoriteTopics: category.toLowerCase() }
          }
        );
      }
    } catch (error) {
      console.error('Error storing preference:', error);
    }
  }

  async getUserPreferences(userId) {
    if (!mongoDB.isConnected) return {};

    try {
      const userPrefsCollection = mongoDB.db.collection('user_preferences');
      const prefs = await userPrefsCollection.findOne({ userId });
      return prefs ? (prefs.preferences || {}) : {};
    } catch (error) {
      console.error('Error getting preferences:', error);
      return {};
    }
  }

  async updateUserActivity(userId) {
    if (!mongoDB.isConnected) return;

    try {
      const userPrefsCollection = mongoDB.db.collection('user_preferences');
      
      await userPrefsCollection.updateOne(
        { userId },
        { 
          $set: { lastActive: new Date() },
          $inc: { totalMessages: 1 },
          $setOnInsert: { 
            createdAt: new Date(),
            preferences: {},
            conversationStyle: 'friendly',
            learnedFactsCount: 0
          }
        },
        { upsert: true }
      );
    } catch (error) {
      console.error('Error updating user activity:', error);
    }
  }

  // Enhanced response generation with MongoDB knowledge
  async generateResponse(message, userId) {
    // Update user activity
    await this.updateUserActivity(userId);
    
    const analysis = this.analyzeMessage(message);
    
    // Check for teaching moments
    if (analysis.type === 'teaching') {
      const storedKnowledge = await this.extractAndStoreKnowledge(message, userId);
      
      if (storedKnowledge.length > 0) {
        const learningResponse = this.responsePatterns.learning[
          Math.floor(Math.random() * this.responsePatterns.learning.length)
        ];
        
        return {
          response: learningResponse,
          typingDelay: 1500,
          messageType: 'learning',
          learned: storedKnowledge,
          timestamp: new Date().toISOString()
        };
      }
    }
    
    // Check for recall requests
    if (analysis.type === 'recall') {
      const topics = this.extractTopicsForRecall(message);
      const recalledFacts = [];
      
      for (const topic of topics) {
        const fact = await this.getKnowledge(userId, topic);
        if (fact) {
          recalledFacts.push({ topic, fact });
        }
      }
      
      if (recalledFacts.length > 0) {
        const recallResponse = this.generateRecallResponse(recalledFacts);
        return {
          response: recallResponse,
          typingDelay: 1200,
          messageType: 'recall',
          recalledFacts: recalledFacts,
          timestamp: new Date().toISOString()
        };
      }
    }
    
    // Check if message contains known topics
    const knownTopics = await this.findKnownTopicsInMessage(message, userId);
    if (knownTopics.length > 0 && Math.random() > 0.5) {
      const topic = knownTopics[0];
      const fact = await this.getKnowledge(userId, topic);
      if (fact) {
        const integratedResponse = this.integrateKnowledge(topic, fact);
        return {
          response: integratedResponse,
          typingDelay: 1600,
          messageType: 'knowledge',
          usedKnowledge: { topic, fact },
          timestamp: new Date().toISOString()
        };
      }
    }
    
    // Generate regular response
    const patterns = this.responsePatterns[analysis.type] || this.responsePatterns.casual;
    const baseResponse = patterns[Math.floor(Math.random() * patterns.length)];
    
    let response = baseResponse;
    if (analysis.type === 'feeling') {
      response = response.replace('{sentiment}', analysis.sentiment);
    }
    
    // Add follow-up questions
    const followUps = [
      " What do you think about that?",
      " How does that sound to you?",
      " I'd love to hear your perspective!",
      " What are your thoughts on this?"
    ];
    
    if (analysis.type !== 'farewell' && Math.random() > 0.3) {
      response += followUps[Math.floor(Math.random() * followUps.length)];
    }
    
    const typingDelay = Math.max(1000, Math.min(3000, response.length * 50));
    
    return {
      response,
      typingDelay,
      messageType: analysis.type,
      sentiment: analysis.sentiment,
      timestamp: new Date().toISOString()
    };
  }

  async findKnownTopicsInMessage(message, userId) {
    const knowledge = await this.getKnowledge(userId);
    const topics = Object.keys(knowledge);
    const foundTopics = [];
    
    const words = message.toLowerCase().split(/\W+/);
    
    words.forEach(word => {
      if (topics.includes(word) && !foundTopics.includes(word)) {
        foundTopics.push(word);
      }
      
      // Also check for multi-word topics
      topics.forEach(topic => {
        if (topic.includes(' ') && message.toLowerCase().includes(topic) && !foundTopics.includes(topic)) {
          foundTopics.push(topic);
        }
      });
    });
    
    return foundTopics;
  }

  integrateKnowledge(topic, fact) {
    const patterns = this.responsePatterns.knowledgeIntegration;
    const pattern = patterns[Math.floor(Math.random() * patterns.length)];
    return pattern.replace('{topic}', topic).replace('{fact}', fact);
  }

  // Message analysis methods
  analyzeMessage(message) {
    const lowerMsg = message.toLowerCase();
    
    if (this.isTeachingPattern(lowerMsg)) {
      return { type: 'teaching', sentiment: 'positive' };
    }
    
    if (this.isRecallPattern(lowerMsg)) {
      return { type: 'recall', sentiment: 'curious' };
    }
    
    // Greeting detection
    if (/(hi|hello|hey|greetings|good morning|good afternoon|good evening)/.test(lowerMsg)) {
      return { type: 'greeting', sentiment: 'positive' };
    }
    
    // Farewell detection
    if (/(bye|goodbye|see ya|farewell|cya|see you|good night)/.test(lowerMsg)) {
      return { type: 'farewell', sentiment: 'neutral' };
    }
    
    // Question detection
    if (/(what|how|why|when|where|who|can you|could you|would you)/.test(lowerMsg) && lowerMsg.includes('?')) {
      return { type: 'question', sentiment: 'curious' };
    }
    
    // Feeling detection
    if (/(feel|feeling|sad|happy|excited|angry|nervous|anxious|depressed|joy|upset)/.test(lowerMsg)) {
      const sentiment = this.detectSentiment(lowerMsg);
      return { type: 'feeling', sentiment };
    }
    
    // Default to casual conversation
    return { type: 'casual', sentiment: this.detectSentiment(lowerMsg) };
  }

  isTeachingPattern(message) {
    const teachingPatterns = [
      /(remember that|you should know|teach you|learn this|fact is|means that)/,
      /(is called|is known as|is a type of|is part of)/,
      /(my name is|i am|i'm from|i live in|my favorite)/,
      /(definition of|what does mean\?)/,
      /(let me teach|i want you to know|you need to know)/
    ];
    
    return teachingPatterns.some(pattern => pattern.test(message));
  }

  isRecallPattern(message) {
    const recallPatterns = [
      /(what did i teach|do you remember|recall that|you learned)/,
      /(tell me what you know about|what do you know about)/
    ];
    
    return recallPatterns.some(pattern => pattern.test(message));
  }

  extractTopicsForRecall(message) {
    const topics = [];
    
    const aboutPattern = message.match(/about (\w+)/i);
    if (aboutPattern) topics.push(aboutPattern[1].toLowerCase());
    
    const tellPattern = message.match(/know about ([\w\s]+)/i);
    if (tellPattern) topics.push(tellPattern[1].toLowerCase().trim());
    
    const words = message.toLowerCase().split(/\s+/);
    words.forEach(word => {
      if (word.length > 3 && !['what', 'about', 'know', 'tell', 'remember'].includes(word)) {
        topics.push(word);
      }
    });
    
    return topics;
  }

  generateRecallResponse(recalledFacts) {
    if (recalledFacts.length === 1) {
      const recallPattern = this.responsePatterns.recall[
        Math.floor(Math.random() * this.responsePatterns.recall.length)
      ];
      return recallPattern.replace('{fact}', recalledFacts[0].fact);
    } else {
      let response = "I remember you taught me several things:\n";
      recalledFacts.forEach((item, index) => {
        response += `\n${index + 1}. ${item.topic}: ${item.fact}`;
      });
      return response;
    }
  }

  detectSentiment(message) {
    const positiveWords = ['good', 'great', 'awesome', 'amazing', 'happy', 'excited', 'love', 'wonderful', 'excellent', 'fantastic'];
    const negativeWords = ['bad', 'terrible', 'awful', 'sad', 'angry', 'hate', 'worried', 'anxious', 'depressed', 'upset'];
    
    const posCount = positiveWords.filter(word => message.includes(word)).length;
    const negCount = negativeWords.filter(word => message.includes(word)).length;
    
    if (posCount > negCount) return 'positive';
    if (negCount > posCount) return 'negative';
    return 'neutral';
  }
}

// Initialize chatbot
const chatbot = new HumanChatbot();

// API Routes
app.post('/api/chat', async (req, res) => {
  const { message, userId = 'default' } = req.body;
  
  if (!message || message.trim() === '') {
    return res.status(400).json({ error: 'Message is required' });
  }

  try {
    const botResponse = await chatbot.generateResponse(message.trim(), userId);
    res.json(botResponse);
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ 
      response: "I apologize, but I'm having trouble processing that right now. Could you try again?",
      typingDelay: 1000,
      messageType: 'error'
    });
  }
});

// Knowledge management endpoints
app.get('/api/knowledge/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const knowledge = await chatbot.getKnowledge(userId);
    res.json({ knowledge });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch knowledge' });
  }
});

app.get('/api/knowledge/:userId/:topic', async (req, res) => {
  try {
    const { userId, topic } = req.params;
    const fact = await chatbot.getKnowledge(userId, topic);
    
    if (fact) {
      res.json({ topic, fact });
    } else {
      res.status(404).json({ error: 'No knowledge found for this topic' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch knowledge' });
  }
});

app.post('/api/knowledge/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { topic, fact, category, examples, tags } = req.body;
    
    if (!topic || !fact) {
      return res.status(400).json({ error: 'Topic and fact are required' });
    }
    
    const result = await chatbot.storeKnowledge(userId, {
      topic,
      fact,
      category,
      examples,
      tags
    });
    
    if (result.success) {
      res.json({ 
        success: true, 
        message: result.updated ? 'Knowledge updated successfully' : 'Knowledge stored successfully',
        learned: result.knowledge 
      });
    } else {
      res.status(500).json({ error: 'Failed to store knowledge' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to store knowledge' });
  }
});

app.get('/api/preferences/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const preferences = await chatbot.getUserPreferences(userId);
    res.json({ preferences });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch preferences' });
  }
});

app.delete('/api/knowledge/:userId/:topic', async (req, res) => {
  try {
    const { userId, topic } = req.params;
    
    if (!mongoDB.isConnected) {
      return res.status(500).json({ error: 'Database not connected' });
    }
    
    const knowledgeCollection = mongoDB.db.collection('knowledge');
    const result = await knowledgeCollection.findOneAndDelete({ 
      userId, 
      topic: topic.toLowerCase() 
    });
    
    if (result.value) {
      res.json({ success: true, message: `Forgot about ${topic}` });
    } else {
      res.status(404).json({ error: 'Topic not found in knowledge base' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete knowledge' });
  }
});

app.get('/api/knowledge/:userId/search/:query', async (req, res) => {
  try {
    const { userId, query } = req.params;
    const results = await chatbot.searchKnowledge(userId, query);
    res.json({ results });
  } catch (error) {
    res.status(500).json({ error: 'Failed to search knowledge' });
  }
});

// User statistics endpoint
app.get('/api/user/:userId/stats', async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!mongoDB.isConnected) {
      return res.json({
        knowledgeCount: 0,
        preferences: {},
        conversationStyle: 'friendly',
        totalMessages: 0,
        lastActive: new Date(),
        recentKnowledge: [],
        databaseConnected: false
      });
    }
    
    const knowledgeCollection = mongoDB.db.collection('knowledge');
    const userPrefsCollection = mongoDB.db.collection('user_preferences');
    
    const knowledgeCount = await knowledgeCollection.countDocuments({ userId });
    const userPrefs = await userPrefsCollection.findOne({ userId });
    const recentKnowledge = await knowledgeCollection.find({ userId })
      .sort({ updatedAt: -1 })
      .limit(5)
      .toArray();
    
    res.json({
      knowledgeCount,
      preferences: userPrefs?.preferences || {},
      conversationStyle: userPrefs?.conversationStyle || 'friendly',
      totalMessages: userPrefs?.totalMessages || 0,
      lastActive: userPrefs?.lastActive || new Date(),
      recentKnowledge: recentKnowledge.map(k => ({
        topic: k.topic,
        fact: k.fact,
        lastUsed: k.lastUsed
      })),
      databaseConnected: true
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user statistics' });
  }
});

// Health check endpoint
app.get('/health', async (req, res) => {
  const dbStatus = mongoDB.isConnected ? 'connected' : 'disconnected';
  
  res.json({ 
    status: 'online', 
    timestamp: new Date().toISOString(),
    service: 'Human Chatbot API',
    database: dbStatus,
    version: '2.0.0'
  });
});

// Serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`🤖 Human Chatbot Server running on port ${PORT}`);
  console.log(`🌐 Web interface: http://localhost:${PORT}`);
  console.log(`💾 MongoDB: ${mongoDB.isConnected ? 'Connected ✅' : 'Disconnected ❌'}`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  await mongoDB.disconnect();
  process.exit(0);
});
