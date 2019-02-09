'use strict';
const bcrypt = require('bcryptjs');
const AWS = require('aws-sdk');
const randomToken = require('random-token');
const dynamoDb = require('./lib/dynamodb');
const saltRounds = 10;

module.exports.signup = async (event, context) => {
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

      // const sqs = new AWS.SQS();
      // await sqs.sendMessage({
      //   MessageBody: JSON.stringify({
      //     email,
      //     confirmToken,
      //   }),
      // }).promise();

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
