# Serverless Signup Flow

Ensure serverless is installed globally:

    $ npm install -g serverless

Create the Serverless project using a NodeJS template:

    $ serverless create --template aws-nodejs --path srsly_signup

Ensure you have your AWS Credentials saved in `~/.aws/credentials`, or run the following command to set up your credentials with the AWS CLI:

    $ aws configure

Create a `package.json` in the project.

Install the Offline plugin, add it to the `serverless.yml` file and add a script in the `package.json` file:

    $ npm install -D serverless-offline

Update the `serverless.yml` file to specify that our signup function should be fired on an HTTP POST request to /signup

```yaml
functions:
  signup:
    handler: handler.signup
    events:
      - http: POST signup
```

We will configure the DynamoDB resource we want to create by adding another section in the `serverless.yml` file:

```yaml
resources:
  Resources:
    usersTable:
      Type: AWS::DynamoDB::Table
      Properties:
        TableName: usersTable
        AttributeDefinitions:
          - AttributeName: email
            AttributeType: S
        KeySchema:
          - AttributeName: email
            KeyType: HASH
        ProvisionedThroughput:
          ReadCapacityUnits: 1
          WriteCapacityUnits: 1

```

## Using DynamoDB Local

To enable us to use DynamoDB locally, we'll install the Serverless DynamoDB Plugin:

    $ npm i -D serverless-dynamodb-local

And add it to the plugins section of `serverless.yml`, above the `offline` plugin so that it's loaded first, and thus automatically, when we run `sls offline`:

```yaml
plugins:
  - serverless-dynamodb-local
  - serverless-offline
```

We should then run `sls dynamodb install` to install the plugin.

To run the app offline with DynamoDB local, we can run:

    $ serverless offline start --migrate

which will perform a migration (i.e. create the tables we need) when DynamoDB Local starts.

I had problems using the `serverless-dynamodb-local` library so I downloaded DynamoDB Local following the [AWS Guide](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/DynamoDBLocal.DownloadingAndRunning.html) and started it with the following command:

    $ java -Djava.library.path=~/DynamoDBLocal_lib -jar ~/DynamoDBLocal.jar -sharedDb

To create the tables, I then ran:

    $ sls dynamodb start --noStart --migrate

Note that the above command needs to be run with the `serverless-dynamodb-local` plugin installed and listed in the `serverless.yml` file.

## The Serverless DynamoDB Client

We will also need to use the [Serverless Dynamodb Client](https://github.com/99xt/serverless-dynamodb-client) which handles switching between our local DynamoDB and the live DynamoDB when in dev/production.

    $ npm i -S serverless-dynamodb-client

We set up the DB connection in `lib/dynamodb.js`.

## Saving a User

In our `handler.js` file we update our handler to save the data to our Users table. We should never save a plain text password so we will install the [bcryptjs](https://github.com/dcodeIO/bcrypt.js) library (there are known issues with the Bcrypt library on lambda) and hash the password before saving it.

In the handler, we'll grab the email and password provided from the request body:

```javascript
const {email, password} = JSON.stringify(event.body);
```

And use the `dynamoDb.putItem` method to save the email and hashed password.

We can check the DynamoDB Local database by going to [http://localhost:8000/shell/](http://localhost:8000/shell/) and executing JS, or with the following command:

    $ aws dynamodb scan \
    --table-name usersTable \
    --endpoint-url http://localhost:8000

## Responding to already existing email address

Since `putItem` will overwrite an already-existing entry, we need to check whether the user already exists before we call this method.

We use the `getItem` method initially to check the email does not already belong to a user, and respond with a 400 status code if we find this to be true.

## Responding to missing parameters

Send back a 400 response if `email` or `password` are missing. You could also check the email is a valid email.

## Generate a confirm_token

When a user is saved, we need to be able to confirm their email address. We will do this by sending an email to their email address with a link to click on to confirm their email.

The link will have a `confirm_token` as a parameter, if the token matches a token saved in the DB against this user, we know the email address truly belongs to this person.

The dispatching of the email will be handled by a second lambda, and the confirmation of email address by a third, but the `signup` lambda needs to be updated to save a token to the DB when a user is created.

## Deployment

Deploy what we've done so far with

    $ sls deploy

We can view the logs with:

    $ sls logs -f signup

## Dispatch an SQS message on Save

```javascript
await sqs.sendMessage({
    QueueUrl: process.env.QUEUE_URL,
    MessageBody: JSON.stringify({
        email,
        confirmToken,
    }),
}).promise();
```

