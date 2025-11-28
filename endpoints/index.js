// Knowledge management endpoints with MongoDB
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
    
    res.json({ 
      success: true, 
      message: result.updated ? 'Knowledge updated successfully' : 'Knowledge stored successfully',
      learned: result.knowledge 
    });
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
    
    const result = await Knowledge.findOneAndDelete({ 
      userId, 
      topic: topic.toLowerCase() 
    });
    
    if (result) {
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
    
    const knowledgeCount = await Knowledge.countDocuments({ userId });
    const userPrefs = await UserPreferences.findOne({ userId });
    const recentKnowledge = await Knowledge.find({ userId })
      .sort({ updatedAt: -1 })
      .limit(5);
    
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
      }))
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user statistics' });
  }
});
