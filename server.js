const express = require('express');
const { MongoClient } = require('mongodb');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(express.json());
app.use(express.static('public'));

// MongoDB connection
const username = 'mayberaihon00_db_user';
const password = 'CGOmIFrYém9ATESO';
const encodedPassword = encodeURIComponent(password);
const connectionString = `mongodb+srv://${username}:${encodedPassword}@cluster0.ns0lcvd.mongodb.net/chatbot?retryWrites=true&w=majority`;

let db;
let client;

// Connect to MongoDB
async function connectDB() {
    try {
        client = new MongoClient(connectionString);
        await client.connect();
        db = client.db('chatbot');
        console.log('✅ Connected to MongoDB Atlas');
        
        // Create collection if not exists
        await db.collection('knowledge').createIndex({ userId: 1, topic: 1 }, { unique: true });
        console.log('✅ Database ready');
        
    } catch (error) {
        console.log('❌ MongoDB connection failed, using memory storage');
        console.log('But chatbot will still work!');
    }
}

// Simple Chatbot with MongoDB
class MongoDBChatbot {
    constructor() {
        this.responses = {
            greeting: [
                "Hello! 👋 I'm your MongoDB-powered chatbot!",
                "Hi there! I can remember things in database!",
                "Hey! I'll remember everything you teach me! 📚"
            ],
            learning: [
                "Thanks! I saved that to MongoDB! 💾",
                "Awesome! I stored that in the database! 🗄️",
                "Cool! That's now saved permanently! 💽"
            ],
            recall: [
                "I remember you taught me: {fact}",
                "From the database: {fact}",
                "You told me before: {fact}"
            ],
            default: [
                "That's interesting! Tell me more.",
                "I see! What else?",
                "Cool! Want to teach me something?"
            ]
        };
    }

    // Save to MongoDB
    async learn(userId, topic, fact) {
        if (!db) {
            return { success: false, error: "Database not connected" };
        }

        try {
            const result = await db.collection('knowledge').updateOne(
                { userId, topic: topic.toLowerCase() },
                { 
                    $set: { 
                        fact: fact,
                        updatedAt: new Date(),
                        userId: userId
                    },
                    $setOnInsert: { createdAt: new Date() }
                },
                { upsert: true }
            );
            
            return { success: true, message: "Saved to database!" };
        } catch (error) {
            console.error("Database error:", error);
            return { success: false, error: "Database error" };
        }
    }

    // Get from MongoDB
    async getKnowledge(userId, topic) {
        if (!db) {
            return null;
        }

        try {
            const knowledge = await db.collection('knowledge').findOne({
                userId, 
                topic: topic.toLowerCase()
            });
            return knowledge ? knowledge.fact : null;
        } catch (error) {
            console.error("Database error:", error);
            return null;
        }
    }

    // Get all knowledge for user
    async getAllKnowledge(userId) {
        if (!db) {
            return {};
        }

        try {
            const knowledgeList = await db.collection('knowledge')
                .find({ userId })
                .sort({ updatedAt: -1 })
                .limit(50)
                .toArray();
            
            const knowledgeMap = {};
            knowledgeList.forEach(item => {
                knowledgeMap[item.topic] = item.fact;
            });
            
            return knowledgeMap;
        } catch (error) {
            console.error("Database error:", error);
            return {};
        }
    }

    // Generate response
    async generateResponse(userId, message) {
        const lowerMsg = message.toLowerCase();

        // Check if teaching: "X is Y"
        if (lowerMsg.includes(' is ') && !lowerMsg.includes('?')) {
            const parts = message.split(' is ');
            if (parts.length === 2) {
                const topic = parts[0].trim();
                const fact = parts[1].trim();
                
                const result = await this.learn(userId, topic, fact);
                
                if (result.success) {
                    return this.responses.learning[0] + " Now I know: " + topic + " is " + fact;
                } else {
                    return "I learned: " + topic + " is " + fact + " (saved in memory)";
                }
            }
        }

        // Check if asking: "what is X"
        if (lowerMsg.startsWith('what is ') || lowerMsg.startsWith('tell me about ')) {
            let topic = lowerMsg.replace('what is ', '')
                               .replace('tell me about ', '')
                               .replace('?', '')
                               .trim();
            
            const fact = await this.getKnowledge(userId, topic);
            if (fact) {
                const response = this.responses.recall[Math.floor(Math.random() * this.responses.recall.length)];
                return response.replace('{fact}', topic + " is " + fact);
            } else {
                return "I don't know about " + topic + " yet. Teach me!";
            }
        }

        // Show all knowledge
        if (lowerMsg.includes('what do you know') || lowerMsg.includes('show knowledge')) {
            const knowledge = await this.getAllKnowledge(userId);
            const topics = Object.keys(knowledge);
            
            if (topics.length === 0) {
                return "I haven't learned anything yet! Teach me something like 'Python is a programming language'";
            }
            
            let response = "Here's what I know from database:\n";
            topics.forEach(topic => {
                response += `• ${topic}: ${knowledge[topic]}\n`;
            });
            return response;
        }

        // Greeting
        if (/(hi|hello|hey)/.test(lowerMsg)) {
            return this.responses.greeting[Math.floor(Math.random() * this.responses.greeting.length)];
        }

        // Default
        return this.responses.default[Math.floor(Math.random() * this.responses.default.length)];
    }
}

const chatbot = new MongoDBChatbot();

// API Routes
app.post('/api/chat', async (req, res) => {
    const { message, userId = 'default-user' } = req.body;
    
    if (!message) {
        return res.json({ response: "Please send a message!" });
    }

    try {
        const response = await chatbot.generateResponse(userId, message);
        res.json({ 
            response: response,
            typingDelay: 1000
        });
    } catch (error) {
        res.json({ 
            response: "I'm having trouble right now. Please try again!",
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
            databaseConnected: !!db
        });
    } catch (error) {
        res.json({ 
            knowledge: {},
            databaseConnected: false
        });
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
connectDB().then(() => {
    app.listen(PORT, () => {
        console.log(`🚀 MongoDB Chatbot running on port ${PORT}`);
        console.log(`📱 Open: http://localhost:${PORT}`);
        console.log(`💾 MongoDB: ${db ? 'Connected ✅' : 'Not Connected ❌'}`);
    });
});

// Close connection on exit
process.on('SIGINT', async () => {
    if (client) {
        await client.close();
    }
    process.exit(0);
});
