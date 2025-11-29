const express = require('express');
const cors = require('cors');
const { MongoClient } = require('mongodb');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// MongoDB connection
const username = 'mayberaihon00_db_user';
const password = 'CGOmIFrYém9ATESO';
const encodedPassword = encodeURIComponent(password);
const connectionString = `mongodb+srv://${username}:${encodedPassword}@cluster0.ns0lcvd.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

let db;
let client;

// Connect to MongoDB
async function connectDB() {
    try {
        client = new MongoClient(connectionString);
        await client.connect();
        db = client.db('chatbot_db');
        console.log('✅ Connected to MongoDB Atlas');
        
        return true;
    } catch (error) {
        console.log('❌ MongoDB connection failed:', error.message);
        return false;
    }
}

// Chatbot Class
class MongoDBChatbot {
    constructor() {
        this.memoryKnowledge = {}; // Fallback storage
    }

    responses = {
        greeting: [
            "Hello! 👋 I'm your MongoDB-powered chatbot!",
            "Hi there! I remember everything in database!",
            "Hey! Teach me something and I'll save it forever! 💾"
        ],
        learning: [
            "✅ Saved to MongoDB! I learned: {topic} is {fact}",
            "💾 Database updated! Now I know: {topic} is {fact}",
            "🎯 Stored permanently! {topic} is {fact}"
        ],
        recall: [
            "📚 From database: {topic} is {fact}",
            "💡 I remember: {topic} is {fact}",
            "🗂️ You taught me: {topic} is {fact}"
        ],
        default: [
            "That's interesting! Tell me more.",
            "I see! What else would you like to share?",
            "Cool! Want to teach me something new?"
        ]
    };

    // Save to MongoDB
    async learn(userId, topic, fact) {
        if (!db) {
            // Fallback to memory
            if (!this.memoryKnowledge[userId]) {
                this.memoryKnowledge[userId] = {};
            }
            this.memoryKnowledge[userId][topic.toLowerCase()] = fact;
            return { success: true, storage: 'memory' };
        }

        try {
            await db.collection('knowledge').updateOne(
                { 
                    userId: userId, 
                    topic: topic.toLowerCase() 
                },
                { 
                    $set: { 
                        fact: fact,
                        updatedAt: new Date(),
                        userId: userId,
                        topic: topic.toLowerCase()
                    },
                    $setOnInsert: { 
                        createdAt: new Date(),
                        usageCount: 0
                    }
                },
                { upsert: true }
            );
            
            return { success: true, storage: 'mongodb' };
        } catch (error) {
            console.error("MongoDB save error:", error);
            // Fallback to memory
            if (!this.memoryKnowledge[userId]) {
                this.memoryKnowledge[userId] = {};
            }
            this.memoryKnowledge[userId][topic.toLowerCase()] = fact;
            return { success: true, storage: 'memory' };
        }
    }

    // Get from MongoDB
    async getKnowledge(userId, topic) {
        if (!db) {
            // Get from memory fallback
            return this.memoryKnowledge[userId] ? this.memoryKnowledge[userId][topic.toLowerCase()] : null;
        }

        try {
            const result = await db.collection('knowledge').findOne({
                userId: userId,
                topic: topic.toLowerCase()
            });
            return result ? result.fact : null;
        } catch (error) {
            console.error("MongoDB fetch error:", error);
            return this.memoryKnowledge[userId] ? this.memoryKnowledge[userId][topic.toLowerCase()] : null;
        }
    }

    // Get all knowledge for user
    async getAllKnowledge(userId) {
        if (!db) {
            return this.memoryKnowledge[userId] || {};
        }

        try {
            const knowledgeList = await db.collection('knowledge')
                .find({ userId: userId })
                .sort({ updatedAt: -1 })
                .limit(100)
                .toArray();
            
            const knowledgeMap = {};
            knowledgeList.forEach(item => {
                knowledgeMap[item.topic] = item.fact;
            });
            
            return knowledgeMap;
        } catch (error) {
            console.error("MongoDB fetch all error:", error);
            return this.memoryKnowledge[userId] || {};
        }
    }

    // Generate response
    async generateResponse(userId, message) {
        const lowerMsg = message.toLowerCase().trim();

        // Check if teaching: "X is Y"
        const teachingMatch = lowerMsg.match(/(.+) is (.+)/);
        if (teachingMatch && !lowerMsg.includes('?')) {
            const topic = teachingMatch[1].trim();
            const fact = teachingMatch[2].trim();
            
            if (topic && fact) {
                const result = await this.learn(userId, topic, fact);
                const response = this.responses.learning[Math.floor(Math.random() * this.responses.learning.length)];
                return response.replace('{topic}', topic).replace('{fact}', fact) + ` (${result.storage})`;
            }
        }

        // Check if asking: "what is X"
        const questionMatch = lowerMsg.match(/what is (.+)/) || lowerMsg.match(/tell me about (.+)/);
        if (questionMatch) {
            const topic = questionMatch[1].replace('?', '').trim();
            const fact = await this.getKnowledge(userId, topic);
            
            if (fact) {
                const response = this.responses.recall[Math.floor(Math.random() * this.responses.recall.length)];
                return response.replace('{topic}', topic).replace('{fact}', fact);
            } else {
                return `I don't know about "${topic}" yet. Teach me by saying "${topic} is ..."`;
            }
        }

        // Show all knowledge
        if (lowerMsg.includes('what do you know') || lowerMsg.includes('show knowledge') || lowerMsg.includes('list knowledge')) {
            const knowledge = await this.getAllKnowledge(userId);
            const topics = Object.keys(knowledge);
            
            if (topics.length === 0) {
                return "I haven't learned anything yet! Teach me something like 'Python is a programming language'";
            }
            
            let response = "📚 Here's everything I know:\n\n";
            topics.forEach((topic, index) => {
                response += `${index + 1}. ${topic}: ${knowledge[topic]}\n`;
            });
            return response;
        }

        // Greeting
        if (/(hi|hello|hey|namaste|hola)/.test(lowerMsg)) {
            return this.responses.greeting[Math.floor(Math.random() * this.responses.greeting.length)];
        }

        // Help
        if (lowerMsg.includes('help')) {
            return `🤖 How to use me:
• Teach: "Python is a programming language"
• Ask: "What is python?"
• List: "What do you know?"
• Examples: "Apple is a fruit", "MongoDB is a database"`;
        }

        // Default response
        return this.responses.default[Math.floor(Math.random() * this.responses.default.length)];
    }
}

const chatbot = new MongoDBChatbot();

// API Routes
app.post('/api/chat', async (req, res) => {
    const { message, userId = 'default-user' } = req.body;
    
    if (!message || message.trim() === '') {
        return res.json({ 
            response: "Please send a message!",
            typingDelay: 500 
        });
    }

    try {
        const response = await chatbot.generateResponse(userId, message.trim());
        res.json({ 
            response: response,
            typingDelay: 800
        });
    } catch (error) {
        console.error('Chat error:', error);
        res.json({ 
            response: "Sorry, I'm having trouble right now. Please try again!",
            typingDelay: 500
        });
    }
});

app.get('/api/knowledge/:userId?', async (req, res) => {
    const userId = req.params.userId || 'default-user';
    
    try {
        const knowledge = await chatbot.getAllKnowledge(userId);
        res.json({ 
            knowledge: knowledge,
            totalItems: Object.keys(knowledge).length,
            databaseConnected: !!db
        });
    } catch (error) {
        res.json({ 
            knowledge: {},
            totalItems: 0,
            databaseConnected: false
        });
    }
});

app.get('/health', (req, res) => {
    res.json({ 
        status: 'online',
        database: db ? 'connected' : 'disconnected',
        timestamp: new Date().toISOString()
    });
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
async function startServer() {
    const dbConnected = await connectDB();
    
    app.listen(PORT, () => {
        console.log(`🚀 MongoDB Chatbot running on port ${PORT}`);
        console.log(`📱 Open: http://localhost:${PORT}`);
        console.log(`💾 MongoDB: ${dbConnected ? 'Connected ✅' : 'Disconnected ❌'}`);
    });
}

startServer();

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down gracefully...');
    if (client) {
        await client.close();
    }
    process.exit(0);
});
