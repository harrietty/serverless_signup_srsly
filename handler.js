'use strict';
require('dotenv').config();
const bcrypt = require('bcryptjs');
const AWS = require('aws-sdk');
const randomToken = require('random-token');
const dynamoDb = require('./lib/dynamodb');
const saltRounds = 10;

module.exports.signup = async (event, context) => {
  if (!process.env.SNS_ARN) throw new Error('SNS_ARN is required');

  const {email, password} = JSON.parse(event.body);
  if (!email || !password) {
    return {
      status: 400,
      body: JSON.stringify({error: 'Email and password are required'}),
    };
  }

  try {
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    const getResponse = await dynamoDb.getItem({
      TableName: 'usersTable',
      Key: {
        email: {
          S: email,
        },
      },
    }).promise();
    if (getResponse.Item) {
      return {
        statusCode: 400,
        body: JSON.stringify({error: `Email address ${email} already in use`}),
      };
    } else {
      const confirmToken = randomToken(16);
      await dynamoDb.putItem({
        TableName: 'usersTable',
        Item: {
          email: {
            S: email,
          },
          password: {
            S: hashedPassword,
          },
          confirm_token: {
            S: confirmToken,
          },
        },
      }).promise();

      const sns = new AWS.SNS();
      await sns.publish({
        Message: JSON.stringify({
          email,
          confirmToken,
        }),
        TargetArn: process.env.SNS_ARN,
      }).promise();

      return {
        statusCode: 201,
      };
    }
  } catch (e) {
    return {
      statusCode: 500,
      body: JSON.stringify({error: e}),
    };
  };
};

module.exports.mailer = async (event, context) => {
  console.log(JSON.stringify(event));
  return 'Sending an email!';
};
