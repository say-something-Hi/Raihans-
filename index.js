const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// Human-like response generator
class HumanChatbot {
  constructor() {
    this.conversationHistory = new Map();
    this.personalityTraits = {
      friendly: true,
      curious: true,
      empathetic: true,
      humorous: true
    };
  }

  // Response patterns for different contexts
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
    ]
  };

  // Analyze message sentiment and type
  analyzeMessage(message) {
    const lowerMsg = message.toLowerCase();
    
    // Greeting detection
    if (/(hi|hello|hey|greetings|good morning|good afternoon)/.test(lowerMsg)) {
      return { type: 'greeting', sentiment: 'positive' };
    }
    
    // Farewell detection
    if (/(bye|goodbye|see ya|farewell|cya)/.test(lowerMsg)) {
      return { type: 'farewell', sentiment: 'neutral' };
    }
    
    // Question detection
    if (/(what|how|why|when|where|who|can you|could you)/.test(lowerMsg) && lowerMsg.includes('?')) {
      return { type: 'question', sentiment: 'curious' };
    }
    
    // Feeling detection
    if (/(feel|feeling|sad|happy|excited|angry|nervous|anxious)/.test(lowerMsg)) {
      const sentiment = this.detectSentiment(lowerMsg);
      return { type: 'feeling', sentiment };
    }
    
    // Default to casual conversation
    return { type: 'casual', sentiment: this.detectSentiment(lowerMsg) };
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

  // Generate human-like response
  generateResponse(message, userId) {
    const analysis = this.analyzeMessage(message);
    const patterns = this.responsePatterns[analysis.type];
    const baseResponse = patterns[Math.floor(Math.random() * patterns.length)];
    
    // Personalize response based on conversation history
    let history = this.conversationHistory.get(userId) || [];
    history.push({ user: message, bot: '', timestamp: new Date() });
    
    // Add contextual elements
    let response = baseResponse;
    if (analysis.type === 'feeling') {
      response = response.replace('{sentiment}', analysis.sentiment);
    }
    
    // Add follow-up questions for engagement
    const followUps = [
      " What do you think about that?",
      " How does that sound to you?",
      " I'd love to hear your perspective!",
      " What are your thoughts on this?"
    ];
    
    if (analysis.type !== 'farewell' && Math.random() > 0.3) {
      response += followUps[Math.floor(Math.random() * followUps.length)];
    }
    
    // Add human-like typing delay simulation
    const typingDelay = Math.max(1000, Math.min(3000, response.length * 50));
    
    // Update conversation history
    if (history.length > 0) {
      history[history.length - 1].bot = response;
    }
    this.conversationHistory.set(userId, history.slice(-10)); // Keep last 10 messages
    
    return {
      response,
      typingDelay,
      messageType: analysis.type,
      sentiment: analysis.sentiment,
      timestamp: new Date().toISOString()
    };
  }

  // Get conversation history
  getHistory(userId) {
    return this.conversationHistory.get(userId) || [];
  }

  // Clear conversation history
  clearHistory(userId) {
    this.conversationHistory.delete(userId);
    return { success: true, message: "Conversation history cleared!" };
  }
}

// Initialize chatbot
const chatbot = new HumanChatbot();

// API Routes
app.post('/api/chat', (req, res) => {
  const { message, userId = 'default' } = req.body;
  
  if (!message || message.trim() === '') {
    return res.status(400).json({ error: 'Message is required' });
  }

  try {
    const botResponse = chatbot.generateResponse(message.trim(), userId);
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

app.get('/api/history/:userId', (req, res) => {
  const { userId } = req.params;
  const history = chatbot.getHistory(userId);
  res.json({ history });
});

app.delete('/api/history/:userId', (req, res) => {
  const { userId } = req.params;
  const result = chatbot.clearHistory(userId);
  res.json(result);
});

// Serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'online', 
    timestamp: new Date().toISOString(),
    service: 'Human Chatbot API'
  });
});

app.listen(PORT, () => {
  console.log(`🤖 Human Chatbot Server running on port ${PORT}`);
  console.log(`🌐 Web interface: http://localhost:${PORT}`);
});
