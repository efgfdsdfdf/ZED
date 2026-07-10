# Zed Healthcare Platform

A comprehensive healthcare platform with AI-powered medical assistance, Supabase authentication, and secure data management.

## 🚀 Quick Start

### Prerequisites

- Node.js (version 18 or higher)
- npm or yarn
- Supabase project with the provided schema
- Anthropic API key

### Installation

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd Zed
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
   Create a `.env` file in the root directory:
   ```
   ANTHROPIC_API_KEY=your_anthropic_api_key_here
   PORT=3000
   ```

4. **Set up Supabase:**
   - Create a Supabase project
   - Run the schema from `supabase-schema.sql` in your Supabase SQL Editor
   - Update the Supabase URL and anon key in `public/zed-core.js` if different from default

5. **Start the server:**
   ```bash
   npm start
   ```

6. **Open the application:**
   Navigate to `http://localhost:3000` in your browser

## 🔧 Configuration

### Supabase Configuration

The application uses Supabase for authentication and data storage. The configuration is in `public/zed-core.js`:

```javascript
const SUPABASE_URL  = 'https://your-project.supabase.co';
const SUPABASE_ANON = 'your-anon-key';
```

### Anthropic API Configuration

The AI features use Anthropic's Claude model. Ensure your API key is properly set in the `.env` file:

```
ANTHROPIC_API_KEY=sk-ant-api03-your-key-here
```

## 📁 Project Structure

```
Zed/
├── public/                 # Frontend files
│   ├── index.html         # Landing page
│   ├── login.html         # Authentication
│   ├── dashboard.html     # Main dashboard
│   ├── chat.html          # AI chat interface
│   ├── zed-core.js        # Core JavaScript library
│   └── zed.css           # Global styles
├── api/                   # API routes (removed - now in server.js)
├── server.js             # Express server
├── supabase-schema.sql   # Database schema
├── package.json          # Dependencies
└── README.md            # This file
```

## 🎯 Features

### Authentication
- Email/password sign-up and login
- OAuth with Google
- Password reset functionality
- Session management with auto-refresh

### AI Chat
- Secure proxy to Anthropic API
- Context-aware medical assistance
- Conversation history
- Profile integration for personalized responses

### Health Management
- Vital signs tracking
- Symptom checker
- Medical report analysis
- Appointment management
- Medication tracking
- Health tips and insights

## 🛠️ Development

### Running in Development Mode

```bash
npm run dev
```

This uses nodemon for automatic restarts during development.

### Testing the Server

Run the test script to verify configuration:

```bash
node test-server.js
```

### Testing the API

Send a test request to the Anthropic proxy:

```bash
curl -X POST http://localhost:3000/api/anthropic \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-3-5-sonnet-20240620",
    "max_tokens": 100,
    "messages": [
      {
        "role": "user",
        "content": "Hello, this is a test message."
      }
    ]
  }'
```

## 🔒 Security

- All API keys are stored server-side
- Frontend uses secure proxy to communicate with AI services
- Supabase Row Level Security (RLS) for data protection
- HTTPS recommended for production

## 🚨 Important Notes

1. **Medical Disclaimer**: This application is for educational/demo purposes only and does not provide actual medical advice.

2. **API Keys**: Never commit API keys to version control. Use environment variables.

3. **Supabase Setup**: Ensure all required tables and RLS policies are properly configured.

4. **CORS**: The server is configured to allow requests from any origin. In production, restrict this to your domain.

## 🐛 Troubleshooting

### Common Issues

1. **"Invalid API key" errors:**
   - Verify your Anthropic API key is correct
   - Check that the key is properly set in `.env`
   - Ensure the key hasn't expired

2. **Supabase authentication failures:**
   - Verify Supabase URL and anon key are correct
   - Check that the user table exists and RLS is configured
   - Ensure email confirmation is set up correctly in Supabase dashboard

3. **CORS errors:**
   - The server allows all origins by default
   - If using a different port, ensure it's allowed in CORS configuration

### Getting Help

If you encounter issues:

1. Check the browser console for JavaScript errors
2. Check the server logs for backend errors
3. Verify all environment variables are set correctly
4. Ensure all dependencies are installed

## 📄 License

This project is for educational purposes. Please respect all third-party licenses for dependencies used.

## 🤝 Contributing

Contributions are welcome! Please ensure:

1. Code follows the existing style
2. New features include appropriate error handling
3. Security best practices are maintained
4. Medical disclaimers are preserved