'use strict';
const bcrypt = require('bcrypt');
const dynamoDb = require('./lib/dynamodb');
const saltRounds = 10;

module.exports.signup = async (event, context) => {
  const {email, password} = JSON.parse(event.body);
  try {
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    const getResponse = await dynamoDb.getItem({
      TableName: 'usersTable',
      Key: {
        email: {
          S: email,
        }
      }
    }).promise();
    if (getResponse.Item) {
      return {
        statusCode: 400,
        body: JSON.stringify({error:`Email address ${email} already in use`}),
      };
    } else {
      await dynamoDb.putItem({
        TableName: 'usersTable',
        Item: {
          email: {
            S: email
          },
          password: {
            S: hashedPassword,
          }
        }
      }).promise();
    }
    return {
      statusCode: 201
    };
  } catch (e) {
    return {
      statusCode: 500,
      body: JSON.stringify({error: e})
    }
  };
};
