const Database = require('./db');
const Knowledge = require('./models/Knowledge');
const UserPreferences = require('./models/UserPreferences');

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
      await Database.connect();
      console.log('🤖 Chatbot initialized with MongoDB storage');
    } catch (error) {
      console.error('Failed to initialize database:', error);
    }
  }

  // Enhanced response patterns
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
    try {
      const { topic, fact, category = 'general', examples = [], tags = [] } = knowledgeData;
      
      const knowledge = new Knowledge({
        userId,
        topic: topic.toLowerCase().trim(),
        fact: fact.trim(),
        category,
        examples,
        tags: [...tags, category],
        confidence: 1,
        source: 'user'
      });

      await knowledge.save();
      
      // Update user preferences to track learning
      await UserPreferences.updateOne(
        { userId },
        { $inc: { learnedFactsCount: 1 } },
        { upsert: true }
      );

      return { success: true, knowledge };
    } catch (error) {
      if (error.code === 11000) {
        // Duplicate key - update existing knowledge
        const updated = await Knowledge.findOneAndUpdate(
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
          { new: true }
        );
        return { success: true, knowledge: updated, updated: true };
      }
      throw error;
    }
  }

  // Get knowledge from MongoDB
  async getKnowledge(userId, topic = null) {
    try {
      if (topic) {
        const knowledge = await Knowledge.findByUserAndTopic(userId, topic);
        if (knowledge) {
          // Increment usage count
          await Knowledge.incrementUsage(userId, topic);
          return knowledge.fact;
        }
        return null;
      } else {
        const knowledgeList = await Knowledge.findByUser(userId);
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
    try {
      const results = await Knowledge.searchKnowledge(userId, query);
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
    const knowledge = this.extractKnowledge(message);
    
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
          storedKnowledge.push({ topic, fact, ...result });
        } catch (error) {
          console.error(`Error storing knowledge for ${topic}:`, error);
        }
      }
      
      return storedKnowledge;
    }
    
    return [];
  }

  // Enhanced knowledge extraction
  extractKnowledge(message) {
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
    
    return knowledge;
  }

  categorizeTopic(topic) {
    const categories = {
      programming: ['javascript', 'python', 'java', 'programming', 'code', 'algorithm'],
      science: ['science', 'physics', 'chemistry', 'biology', 'space', 'universe'],
      geography: ['country', 'city', 'capital', 'location', 'map'],
      food: ['food', 'cuisine', 'recipe', 'cooking', 'restaurant'],
      entertainment: ['movie', 'music', 'game', 'book', 'artist'],
      personal: ['favorite', 'like', 'love', 'hate', 'prefer']
    };
    
    for (const [category, keywords] of Object.entries(categories)) {
      if (keywords.some(keyword => topic.includes(keyword))) {
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
    try {
      await UserPreferences.updatePreference(userId, category, value);
      
      if (['color', 'food', 'movie', 'music', 'book'].includes(category.toLowerCase())) {
        await UserPreferences.addFavoriteTopic(userId, category);
      }
    } catch (error) {
      console.error('Error storing preference:', error);
    }
  }

  async getUserPreferences(userId) {
    try {
      const prefs = await UserPreferences.findOne({ userId });
      return prefs ? prefs.preferences : {};
    } catch (error) {
      console.error('Error getting preferences:', error);
      return {};
    }
  }

  // Enhanced response generation with MongoDB knowledge
  async generateResponse(message, userId) {
    // Update user activity
    await UserPreferences.updateLastActive(userId);
    
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
    if (knownTopics.length > 0 && Math.random() > 0.7) {
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
    
    // Generate regular response (your existing code)
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
    });
    
    return foundTopics;
  }

  integrateKnowledge(topic, fact) {
    const patterns = this.responsePatterns.knowledgeIntegration;
    const pattern = patterns[Math.floor(Math.random() * patterns.length)];
    return pattern.replace('{topic}', topic).replace('{fact}', fact);
  }

  // Keep your existing analysis methods
  analyzeMessage(message) {
    const lowerMsg = message.toLowerCase();
    
    if (this.isTeachingPattern(lowerMsg)) {
      return { type: 'teaching', sentiment: 'positive' };
    }
    
    if (this.isRecallPattern(lowerMsg)) {
      return { type: 'recall', sentiment: 'curious' };
    }
    
    // ... rest of your existing analysis code
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
    const positiveWords = ['good', 'great', 'awesome', 'amazing', 'happy', 'excited', 'love', 'wonderful'];
    const negativeWords = ['bad', 'terrible', 'awful', 'sad', 'angry', 'hate', 'worried', 'anxious'];
    
    const posCount = positiveWords.filter(word => message.includes(word)).length;
    const negCount = negativeWords.filter(word => message.includes(word)).length;
    
    if (posCount > negCount) return 'positive';
    if (negCount > posCount) return 'negative';
    return 'neutral';
  }
             }
