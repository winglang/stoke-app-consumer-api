./node_modules/.bin/serverless dynamodb start
npm run db:admin
npm run dbmigrate
npm test -- -f entUsrList
./node_modules/.bin/serverless offline start
curl http://localhost:3000/dev/users?companyId=offlineContext_cognitoIdentityId

all tables on the same container
table names coming from process.env
event.requestContext.identity

