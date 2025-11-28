const mongoose = require('mongoose');

class Database {
  constructor() {
    this.connection = null;
  }

  async connect() {
    try {
      // Use your provided credentials
      const username = 'mayberaihon00_db_user';
      const password = 'CGOmIFrYém9ATESO';
      const cluster = 'cluster0.ns0lcvd.mongodb.net';
      const dbName = 'chatbot_db';
      
      const connectionString = `mongodb+srv://${username}:${encodeURIComponent(password)}@${cluster}/${dbName}?retryWrites=true&w=majority`;
      
      this.connection = await mongoose.connect(connectionString, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      });
      
      console.log('✅ Connected to MongoDB Atlas');
      return this.connection;
    } catch (error) {
      console.error('❌ MongoDB connection error:', error);
      throw error;
    }
  }

  async disconnect() {
    if (this.connection) {
      await mongoose.disconnect();
      console.log('✅ Disconnected from MongoDB');
    }
  }
}

module.exports = new Database();
