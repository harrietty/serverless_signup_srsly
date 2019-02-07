'use strict';
const AWS = require('aws-sdk');
let options = {};

// connect to local DB if running offline
if (process.env.NODE_ENV === 'development') {
  options = {
    endpoint: 'http://localhost:8000',
  };
}

const client = new AWS.DynamoDB(options);

module.exports = client;
