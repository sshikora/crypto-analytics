import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

console.log('Environment Variables Check:');
console.log('=============================');
console.log('DYNAMODB_NOTIFICATION_RULES_TABLE:', process.env.DYNAMODB_NOTIFICATION_RULES_TABLE);
console.log('DYNAMODB_NOTIFICATIONS_TABLE:', process.env.DYNAMODB_NOTIFICATIONS_TABLE);
console.log('DYNAMODB_EMAIL_RATE_LIMIT_TABLE:', process.env.DYNAMODB_EMAIL_RATE_LIMIT_TABLE);
console.log('AWS_REGION:', process.env.AWS_REGION);
