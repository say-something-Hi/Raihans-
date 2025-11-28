const meta = {
  name: "chat",
  version: "1.0.0",
  description: "Human-like chatbot endpoint with no API keys required",
  author: "Your Name",
  method: "post",
  category: "chat",
  path: "/api/chat"
};

async function onStart({ res, req }) {
  const { message, userId } = req.body;

  if (!message) {
    return res.status(400).json({ 
      error: 'Message is required',
      response: "I didn't receive any message. Could you please say something?",
      typingDelay: 1000
    });
  }

  // Simple response generation for the endpoint
  const responses = [
    "That's really interesting! Tell me more about that.",
    "I understand what you're saying. How do you feel about it?",
    "That's a great point! I never thought about it that way.",
    "Thanks for sharing that with me. What else is on your mind?",
    "I appreciate you telling me that. It sounds important to you."
  ];

  const randomResponse = responses[Math.floor(Math.random() * responses.length)];
  const typingDelay = Math.max(800, Math.min(2500, message.length * 30));

  return res.json({
    response: randomResponse,
    typingDelay: typingDelay,
    messageType: 'casual',
    sentiment: 'positive',
    timestamp: new Date().toISOString(),
    powered_by: "Human Chatbot API"
  });
}

module.exports = { meta, onStart };
