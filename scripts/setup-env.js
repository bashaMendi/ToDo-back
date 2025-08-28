#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

console.log('Setting up environment variables for Shared Tasks Backend\n');

// Generate secure secrets
const sessionSecret = crypto.randomBytes(32).toString('hex');
const pepper = crypto.randomBytes(16).toString('hex');

// Template for .env file
const envTemplate = `# Server Configuration
NODE_ENV=development
PORT=3001

# Database Configuration (MongoDB Atlas)
# החלף את הפרטים הבאים עם הפרטים שלך מ-Atlas:
DATABASE_URL="mongodb+srv://YOUR_USERNAME:YOUR_PASSWORD@YOUR_CLUSTER_URL/shared-tasks?retryWrites=true&w=majority"

# Session Configuration (Generated automatically)
SESSION_SECRET="${sessionSecret}"
PEPPER="${pepper}"

# Frontend URL
FRONTEND_URL=http://localhost:3000

# CORS Configuration
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001

# Logging
LOG_LEVEL=info
`;

const envPath = path.join(__dirname, '..', '.env');

// Check if .env already exists
if (fs.existsSync(envPath)) {
  console.log('File .env already exists!');
  console.log('Please update the DATABASE_URL manually with your Atlas connection string.');
  console.log('\nYour Atlas connection string should look like:');
  console.log('mongodb+srv://username:password@cluster.mongodb.net/shared-tasks?retryWrites=true&w=majority');
} else {
  // Create .env file
  fs.writeFileSync(envPath, envTemplate);
  console.log('Created .env file successfully!');
  console.log('Generated secure session secrets');
  console.log('\nNext steps:');
  console.log('1. Update DATABASE_URL with your Atlas connection string');
  console.log('2. Run: npm run prisma:push');
  console.log('3. Run: npm run dev');
}

console.log('\nFor detailed instructions, see: ATLAS_SETUP.md');
